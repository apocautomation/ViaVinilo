import { Prisma, type PrismaClient } from "@prisma/client";
import { checkFile, readImageInfo, readPdfPageSize, type FileCheck } from "@viavinilo/contracts";
import { assumePair, extractMeasures, type DeclaredMeasure } from "./mail/measures";
import type { FileStorage } from "./storage";

/**
 * Control automático del archivo (D-047, D-065). Revisa cada pedido en "Archivo recibido" que todavía
 * no se controló (los nuevos, por mail o por la app, y los que recibieron un archivo corregido).
 * - Siempre guarda el resultado en el pedido: el tablero lo muestra como sugerencia.
 * - Si el archivo está claramente mal y el control automático está prendido, el pedido pasa solo a
 *   "Archivo con error" con el motivo. Arranca apagado; lo prende el dueño (I-24).
 */
export const FILE_CHECK_SETTING_KEY = "auto-file-error";

/** Desde cuándo está prendido el paso automático, o null si está apagado. */
async function autoSince(prisma: PrismaClient): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: FILE_CHECK_SETTING_KEY } });
  const v = row?.value as { enabled?: unknown; since?: unknown } | null;
  if (v?.enabled !== true) return null;
  return typeof v.since === "string" ? new Date(v.since) : (row?.updatedAt ?? null);
}

const IMAGE = /\.(png|jpe?g)$/i;
const PDF = /\.pdf$/i;

type CheckMeasure = DeclaredMeasure & { assumed?: boolean };

/**
 * Medidas del pedido: las que ya se leyeron al entrar el mail y, si no alcanzan, las que haya en el
 * asunto, el cuerpo, la nota o la descripción. Si el cliente escribió un par sin unidad ("58x30"),
 * se supone la unidad por el número (D-071).
 */
export function measuresOf(specs: unknown, description: string | null): CheckMeasure[] {
  const s = (specs ?? {}) as { measures?: unknown; note?: unknown; subject?: unknown; body?: unknown };
  const stored = Array.isArray(s.measures) ? (s.measures as DeclaredMeasure[]) : [];
  const text = [s.note, s.subject, s.body, description].filter((x): x is string => typeof x === "string").join("\n");
  const found: CheckMeasure[] = stored.some((m) => m.widthCm && m.heightCm) ? stored : [...stored, ...extractMeasures(text)];
  if (found.some((m) => m.widthCm && m.heightCm)) return found;
  // Ninguna con unidad: se prueba suponerla. Si quedan varias distintas, checkFile no decide.
  const seen = new Set<string>();
  const assumed: CheckMeasure[] = [];
  for (const m of found) {
    const pair = assumePair(m.raw);
    const key = pair ? `${pair.widthCm}|${pair.heightCm}` : "";
    if (!pair || seen.has(key)) continue;
    seen.add(key);
    assumed.push({ raw: m.raw, ...pair, assumed: true });
  }
  return assumed.length ? assumed : found;
}

export async function processFileChecks(
  prisma: PrismaClient,
  storage: Pick<FileStorage, "getHead">,
  opts: { limit?: number } = {},
): Promise<{ checked: number; errors: number }> {
  const jobs = await prisma.jobOrder.findMany({
    where: { status: "RECEIVED", deletedAt: null, fileCheck: { equals: Prisma.DbNull } },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 20,
    include: { sector: { select: { code: true, name: true } }, files: { where: { deletedAt: null, purgedAt: null }, orderBy: { createdAt: "desc" } } },
  });
  if (!jobs.length) return { checked: 0, errors: 0 };
  const since = await autoSince(prisma);
  let errors = 0;

  for (const job of jobs) {
    // Se controla el archivo más nuevo que se pueda leer: primero una imagen, si no un PDF.
    const file = job.files.find((f) => IMAGE.test(f.filename)) ?? job.files.find((f) => PDF.test(f.filename));
    let check: FileCheck;
    if (!file) {
      const noFile = job.linksNote ?? (job.externalLinks.length && !job.linksFetchedAt ? "El archivo llegó por un link: se está bajando." : "El pedido no tiene archivos guardados.");
      check = job.files.length
        ? { verdict: "unknown", detail: "El archivo no es PNG, JPG ni PDF: no se puede controlar solo." }
        : { verdict: "unknown", detail: noFile, ...(job.linksNote ? { hint: job.linksNote } : {}) };
    } else {
      const head = await storage.getHead(file.storageKey, 2 * 1024 * 1024).catch(() => null);
      const isPdf = PDF.test(file.filename);
      check = checkFile({
        sectorCode: job.sector.code,
        sectorName: job.sector.name,
        filename: file.filename,
        image: head && !isPdf ? readImageInfo(head) : null,
        pdf: head && isPdf ? readPdfPageSize(head) : null,
        measures: measuresOf(job.requestedSpecs, job.description),
      });
    }
    await prisma.jobOrder.update({ where: { id: job.id }, data: { fileCheck: check as unknown as Prisma.InputJsonValue } });

    // Paso automático: solo si está prendido, el caso es claro y el archivo llegó después de prenderlo.
    if (check.verdict !== "error" || !since || !file || file.createdAt < since) continue;
    const reason = await prisma.fileErrorReason.findUnique({ where: { code: check.reasonCode ?? "LOW_RESOLUTION" } });
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.jobOrder.updateMany({ where: { id: job.id, status: "RECEIVED" }, data: { status: "FILE_ERROR" } });
      if (count === 0) return;
      await tx.jobEvent.create({
        data: { jobId: job.id, fromStatus: "RECEIVED", toStatus: "FILE_ERROR", reasonId: reason?.id ?? null, note: `Control automático: ${check.detail}` },
      });
      errors++;
    });
  }
  return { checked: jobs.length, errors };
}
