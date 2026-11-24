import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { StorageFullError, type FileStorage } from "../storage";
import { isNoiseLink, openLink, PROVIDER_NAME, resolveLink, type DownloadFailure, type LinkProvider, type LinkTarget, type OpenResult } from "./download";

/**
 * Baja al servidor los archivos que el cliente mandó por un link (D-072, D-076): Google Drive (archivos
 * y carpetas), OneDrive, WeTransfer y Dropbox. El archivo queda en el pedido como si hubiera venido
 * adjunto: el operador lo descarga desde la tarjeta y pasa por el control automático.
 * - Sin tope de cantidad de links ni de tamaño por archivo: se escribe directo al disco.
 * - Lo único que frena una descarga es que el disco se esté quedando sin lugar (ver MIN_FREE_BYTES).
 * - Cada pedido se intenta una sola vez. Si no se puede, la tarjeta dice por qué.
 * - No toca pedidos entregados ni cancelados.
 */
export interface LinkClient {
  /** De un link, las descargas a hacer (una carpeta da varias). null = servicio que no se baja solo. */
  resolve(link: string): Promise<{ provider: LinkProvider; targets: LinkTarget[] } | { provider: LinkProvider; failure: DownloadFailure } | null>;
  open(target: LinkTarget): Promise<OpenResult>;
}

export const defaultLinkClient: LinkClient = { resolve: (link) => resolveLink(link), open: (target) => openLink(target) };

/**
 * Lugar que siempre tiene que quedar libre en el disco. La base de datos y sus copias viven en el
 * mismo disco: si se llena, se cae todo el sistema.
 */
export const MIN_FREE_BYTES = 10 * 1024 * 1024 * 1024;

const WHY: Record<DownloadFailure, string> = {
  private: "el link no es público: pedile al cliente que lo comparta con «cualquier persona que tenga el enlace»",
  not_found: "el link ya no existe o venció",
  not_a_file: "el link no lleva a un archivo",
  no_space: "el servidor se está quedando sin lugar en el disco; avisale a soporte",
  error: "no se pudo conectar",
};

const DRIVE_NOT_FOUND =
  "Google no lo entrega: se borró o solo lo puede abrir quien recibió el mail. Pedile al cliente que lo comparta con «cualquier persona que tenga el enlace» o que lo mande adjunto";

type Storage = Pick<FileStorage, "putStream" | "freeBytes">;

export async function processLinkDownloads(
  prisma: PrismaClient,
  storage: Storage,
  client: LinkClient = defaultLinkClient,
  opts: { limit?: number; now?: Date; minFreeBytes?: number } = {},
): Promise<{ jobs: number; files: number; failed: number }> {
  const now = opts.now ?? new Date();
  const minFree = opts.minFreeBytes ?? MIN_FREE_BYTES;
  const jobs = await prisma.jobOrder.findMany({
    where: { linksFetchedAt: null, deletedAt: null, status: { in: ["RECEIVED", "PENDING_SIGNUP", "FILE_ERROR"] }, NOT: { externalLinks: { isEmpty: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 3,
    select: { id: true, externalLinks: true },
  });

  let files = 0;
  let failed = 0;
  for (const job of jobs) {
    // Se marca primero: si dos workers lo leen a la vez, lo baja uno solo; y no se reintenta en loop.
    const { count } = await prisma.jobOrder.updateMany({ where: { id: job.id, linksFetchedAt: null }, data: { linksFetchedAt: now } });
    if (count === 0) continue;

    const notes: string[] = [];
    const created: Prisma.JobFileCreateManyInput[] = [];
    const fail = (provider: LinkProvider, reason: DownloadFailure) => {
      failed++;
      // Google contesta "no existe" también cuando el archivo está, pero solo lo puede abrir quien recibió el mail.
      const why = provider === "drive" && reason === "not_found" ? DRIVE_NOT_FOUND : WHY[reason];
      notes.push(`No se pudo bajar el archivo de ${PROVIDER_NAME[provider]}: ${why}.`);
    };

    // Un link copiado de un mail en HTML puede traer "&amp;" en vez de "&": se corrige antes de usarlo.
    const links = [...new Set(job.externalLinks.map((l) => l.replace(/&amp;/g, "&")))];
    for (const link of links.filter((l) => !isNoiseLink(l))) {
      const resolved = await client.resolve(link);
      if (!resolved) {
        notes.push("Hay un link de un servicio que no se baja solo: abrilo desde el mail.");
        continue;
      }
      if ("failure" in resolved) {
        fail(resolved.provider, resolved.failure);
        continue;
      }
      for (const target of resolved.targets) {
        const opened = await client.open(target);
        if (!opened.ok) {
          fail(target.provider, opened.reason);
          continue;
        }
        const { filename, mime, declaredBytes, body } = opened.file;
        // Cuánto se puede escribir sin dejar el disco por debajo del mínimo.
        const room = (await storage.freeBytes()) - minFree;
        if (room <= 0 || (declaredBytes !== null && declaredBytes > room)) {
          await body.cancel().catch(() => undefined);
          fail(target.provider, "no_space");
          continue;
        }
        // Clave estable por pedido y descarga: si se repite, pisa el mismo archivo. La dirección directa de
        // WeTransfer cambia en cada pedido, así que ahí se usa el link que escribió el cliente.
        const stable = target.provider === "wetransfer" ? link : target.url;
        const storageKey = `links/${job.id}/${createHash("sha256").update(stable).digest("hex").slice(0, 16)}-${filename}`;
        try {
          const { size, checksum } = await storage.putStream(storageKey, body, { maxBytes: room });
          if (size === 0) {
            fail(target.provider, "error");
            continue;
          }
          created.push({ jobId: job.id, filename, storageKey, sizeBytes: BigInt(size), mime, checksum });
        } catch (err) {
          fail(target.provider, err instanceof StorageFullError ? "no_space" : "error");
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (created.length) await tx.jobFile.createMany({ data: created, skipDuplicates: true });
      await tx.jobOrder.update({
        where: { id: job.id },
        // El control automático revisa el pedido de nuevo: con el archivo bajado, o para explicar por qué no está.
        data: { linksNote: [...new Set(notes)].join(" ") || null, fileCheck: Prisma.DbNull },
      });
    });
    files += created.length;
  }
  return { jobs: jobs.length, files, failed };
}
