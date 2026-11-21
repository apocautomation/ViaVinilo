import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeOldFiles } from "../src/retention";
import { LocalDiskStorage } from "../src/storage";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "vv-retention-"));
const storage = new LocalDiskStorage(dir);
const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-12-31T12:00:00Z");

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
  rmSync(dir, { recursive: true, force: true });
});

describe("retención de archivos (D-015)", () => {
  it("D-015: borra solo los archivos de órdenes entregadas hace más de 30 días y deja registro", async () => {
    const sector = await prisma.sector.create({ data: { code: "DTF", name: "DTF" } });
    const customer = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Ana" } });
    const job = async (key: string, status: "DELIVERED" | "READY", deliveredDaysAgo: number | null) => {
      await storage.put(key, Buffer.from("archivo"));
      return prisma.jobOrder.create({
        data: {
          customerId: customer.id,
          sectorId: sector.id,
          status,
          source: "EMAIL",
          deliveredAt: deliveredDaysAgo === null ? null : new Date(now.getTime() - deliveredDaysAgo * DAY),
          files: { create: { filename: "a.pdf", storageKey: key, sizeBytes: BigInt(7), mime: "application/pdf", checksum: key } },
        },
        include: { files: true },
      });
    };
    const old = await job("mail/dtf/viejo/1-a.pdf", "DELIVERED", 31);
    const recent = await job("mail/dtf/reciente/1-a.pdf", "DELIVERED", 29);
    const notDelivered = await job("mail/dtf/sin-entregar/1-a.pdf", "READY", null);

    expect(await purgeOldFiles(prisma, storage, { now })).toEqual({ purged: 1, jobs: 1, failed: 0 });
    expect(existsSync(join(dir, "mail/dtf/viejo/1-a.pdf"))).toBe(false);
    expect(existsSync(join(dir, "mail/dtf/reciente/1-a.pdf"))).toBe(true);
    expect(existsSync(join(dir, "mail/dtf/sin-entregar/1-a.pdf"))).toBe(true);
    expect((await prisma.jobFile.findUniqueOrThrow({ where: { id: old.files[0]!.id } })).purgedAt).toEqual(now);
    expect((await prisma.jobFile.findUniqueOrThrow({ where: { id: recent.files[0]!.id } })).purgedAt).toBeNull();
    expect((await prisma.jobFile.findUniqueOrThrow({ where: { id: notDelivered.files[0]!.id } })).purgedAt).toBeNull();
    expect((await prisma.auditLog.findFirstOrThrow({ where: { entityId: old.id, action: "files_purged" } })).after).toMatchObject({ files: 1 });
    // Otra corrida no vuelve a borrar nada.
    expect(await purgeOldFiles(prisma, storage, { now })).toEqual({ purged: 0, jobs: 0, failed: 0 });
  });
});
