import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Arranque del sistema (D-115). Hasta el día de arranque los pedidos que entraron por mail se
 * trabajaron por fuera (por mail, como siempre): en el tablero eran cientos en "Archivo recibido" que
 * ya estaban hechos. Llegada la fecha, esos pedidos se archivan solos: dejan de verse en los
 * tableros, la app de clientes, el bot y los números de Inicio, pero quedan en la base con su
 * historial y un registro en la auditoría por cada uno (se pueden volver a mostrar).
 *
 * Se configura con el ajuste `goLive` (`AppSetting`): `{ "at": "2026-11-27T03:00:00.000Z", "keep": [564] }`.
 * `keep` son números de pedido que no se tocan (por ejemplo, el de prueba). Corre una sola vez: al
 * terminar anota `doneAt` y cuántos archivó.
 */
export const GO_LIVE_KEY = "goLive";
export const GO_LIVE_ACTION = "archive_before_go_live";

interface GoLive {
  at: string;
  keep?: number[];
  doneAt?: string;
  archived?: number;
}

const parse = (value: Prisma.JsonValue): GoLive | null => {
  const v = value as Partial<GoLive> | null;
  if (!v || typeof v !== "object" || typeof v.at !== "string" || Number.isNaN(Date.parse(v.at))) return null;
  return { at: v.at, keep: Array.isArray(v.keep) ? v.keep.filter((n): n is number => Number.isInteger(n)) : [], doneAt: v.doneAt, archived: v.archived };
};

export async function archiveBeforeGoLive(prisma: PrismaClient, now = new Date()): Promise<{ archived: number } | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: GO_LIVE_KEY } });
  const goLive = row ? parse(row.value) : null;
  if (!goLive || goLive.doneAt) return null;
  const at = new Date(goLive.at);
  if (now < at) return null;

  const jobs = await prisma.jobOrder.findMany({
    where: { deletedAt: null, createdAt: { lt: at }, number: { notIn: goLive.keep ?? [] } },
    select: { id: true, number: true, status: true },
  });
  await prisma.$transaction([
    prisma.jobOrder.updateMany({ where: { id: { in: jobs.map((j) => j.id) }, deletedAt: null }, data: { deletedAt: now } }),
    prisma.auditLog.createMany({
      data: jobs.map((j) => ({ entity: "JobOrder", entityId: j.id, action: GO_LIVE_ACTION, after: { number: j.number, status: j.status, goLive: goLive.at } })),
    }),
    prisma.appSetting.update({
      where: { key: GO_LIVE_KEY },
      data: { value: { ...goLive, doneAt: now.toISOString(), archived: jobs.length } as unknown as Prisma.InputJsonValue },
    }),
  ]);
  return { archived: jobs.length };
}
