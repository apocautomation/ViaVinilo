import type { PrismaClient } from "@prisma/client";
import type { FileStorage } from "./storage";

/**
 * Retención de archivos (D-015): los archivos de impresión se borran a los 30 días de entregada la
 * orden. Las órdenes que no se entregaron no se tocan. Se borra el archivo del disco y el registro
 * queda con la fecha de borrado (`purgedAt`); en la auditoría queda cuántos se borraron por orden.
 */
export const RETENTION_DAYS = 30;

export async function purgeOldFiles(
  prisma: PrismaClient,
  storage: Pick<FileStorage, "remove">,
  opts: { now?: Date; limit?: number } = {},
): Promise<{ purged: number; jobs: number; failed: number }> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const files = await prisma.jobFile.findMany({
    where: { purgedAt: null, job: { status: "DELIVERED", deliveredAt: { lt: cutoff } } },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 500,
    select: { id: true, jobId: true, storageKey: true },
  });

  const perJob = new Map<string, number>();
  let failed = 0;
  for (const f of files) {
    try {
      await storage.remove(f.storageKey);
      await prisma.jobFile.update({ where: { id: f.id }, data: { purgedAt: now } });
      perJob.set(f.jobId, (perJob.get(f.jobId) ?? 0) + 1);
    } catch (err) {
      // Si un archivo no se puede borrar, se reintenta en la próxima corrida y se sigue con el resto.
      failed++;
      console.error(`[retención] no se pudo borrar ${f.storageKey}:`, err instanceof Error ? err.message : err);
    }
  }
  for (const [jobId, count] of perJob) {
    await prisma.auditLog.create({
      data: { entity: "JobOrder", entityId: jobId, action: "files_purged", after: { files: count, reason: `Más de ${RETENTION_DAYS} días desde la entrega (D-015)` } },
    });
  }
  return { purged: files.length - failed, jobs: perJob.size, failed };
}
