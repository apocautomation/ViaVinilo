import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GO_LIVE_ACTION, GO_LIVE_KEY, archiveBeforeGoLive } from "../src/go-live";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

describe("arranque del sistema (D-115)", () => {
  it("D-115: llegada la fecha, archiva una sola vez lo que entró antes (menos los que se guardan) y deja registro", async () => {
    const sector = await prisma.sector.create({ data: { code: "DTF", name: "DTF" } });
    const customer = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } });
    const at = new Date("2026-11-27T03:00:00.000Z");
    const job = (createdAt: Date, status: "RECEIVED" | "READY" = "RECEIVED") =>
      prisma.jobOrder.create({ data: { customerId: customer.id, sectorId: sector.id, status, source: "EMAIL", createdAt } });
    const viejo = await job(new Date("2026-11-20T15:00:00Z"));
    const ayer = await job(new Date("2026-11-26T23:59:00Z"));
    const prueba = await job(new Date("2026-11-24T12:00:00Z"), "READY");
    const nuevo = await job(new Date("2026-11-27T11:00:00Z"));

    // Sin ajuste, no hace nada.
    expect(await archiveBeforeGoLive(prisma, new Date("2026-11-28T00:00:00Z"))).toBeNull();

    await prisma.appSetting.create({ data: { key: GO_LIVE_KEY, value: { at: at.toISOString(), keep: [prueba.number] } } });
    // Antes de la fecha, tampoco.
    expect(await archiveBeforeGoLive(prisma, new Date("2026-11-27T02:59:00Z"))).toBeNull();
    expect(await prisma.jobOrder.count({ where: { deletedAt: null } })).toBe(4);

    expect(await archiveBeforeGoLive(prisma, new Date("2026-11-27T03:05:00Z"))).toEqual({ archived: 2 });
    const visibles = await prisma.jobOrder.findMany({ where: { deletedAt: null }, select: { id: true } });
    expect(visibles.map((j) => j.id).sort()).toEqual([prueba.id, nuevo.id].sort());
    // Quedan en la base, con su registro.
    expect(await prisma.jobOrder.count({ where: { id: { in: [viejo.id, ayer.id] }, deletedAt: { not: null } } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: GO_LIVE_ACTION } })).toBe(2);
    const setting = await prisma.appSetting.findUniqueOrThrow({ where: { key: GO_LIVE_KEY } });
    expect(setting.value).toMatchObject({ archived: 2, doneAt: "2026-11-27T03:05:00.000Z" });

    // Una sola vez: lo que entra después no se toca.
    await job(new Date("2026-11-26T10:00:00Z"));
    expect(await archiveBeforeGoLive(prisma, new Date("2026-11-27T04:00:00Z"))).toBeNull();
    expect(await prisma.jobOrder.count({ where: { deletedAt: null } })).toBe(3);
  });
});
