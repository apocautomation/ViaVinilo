import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { MAX_UPLOAD_BYTES } from "@viavinilo/contracts";
import type { FileStorage } from "../storage";
import { downloadLink, linkTarget, type DownloadFailure, type DownloadResult, type LinkTarget } from "./download";

/**
 * Baja al servidor los archivos que el cliente mandó por un link de Google Drive o OneDrive (D-072).
 * El archivo queda en el pedido como si hubiera venido adjunto: el operador lo descarga desde la
 * tarjeta y pasa por el control automático.
 * - Cada pedido se intenta una sola vez. Si no se puede, la tarjeta dice por qué.
 * - No toca pedidos entregados ni cancelados.
 */
export type LinkDownloader = (target: LinkTarget) => Promise<DownloadResult>;

export const defaultDownloader: LinkDownloader = (target) => downloadLink(target, { maxBytes: MAX_UPLOAD_BYTES });

const WHY: Record<DownloadFailure, string> = {
  private: "el link no es público: pedile al cliente que lo comparta con «cualquier persona que tenga el enlace»",
  not_found: "el link ya no existe o fue borrado",
  too_big: "el archivo pesa más de 150 MB",
  not_a_file: "el link no lleva a un archivo",
  error: "no se pudo conectar",
};

export async function processLinkDownloads(
  prisma: PrismaClient,
  storage: Pick<FileStorage, "put">,
  download: LinkDownloader = defaultDownloader,
  opts: { limit?: number; now?: Date } = {},
): Promise<{ jobs: number; files: number; failed: number }> {
  const now = opts.now ?? new Date();
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

    const targets = job.externalLinks.map((link) => ({ link, target: linkTarget(link) }));
    const notes: string[] = [];
    const created: Prisma.JobFileCreateManyInput[] = [];
    for (const { link, target } of targets) {
      if (!target) {
        notes.push("Hay un link que no se baja solo (no es un archivo de Drive ni de OneDrive): abrilo desde el mail.");
        continue;
      }
      const result = await download(target);
      if (!result.ok) {
        failed++;
        notes.push(`No se pudo bajar el archivo de ${target.provider === "drive" ? "Google Drive" : "OneDrive"}: ${WHY[result.reason]}.`);
        continue;
      }
      const { filename, mime, content } = result.file;
      // Clave estable por pedido y link: si se repite, pisa el mismo archivo.
      const storageKey = `links/${job.id}/${createHash("sha256").update(link).digest("hex").slice(0, 16)}-${filename}`;
      await storage.put(storageKey, content);
      created.push({ jobId: job.id, filename, storageKey, sizeBytes: BigInt(content.length), mime, checksum: createHash("sha256").update(content).digest("hex") });
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
