import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { JOB_STATUSES, SECTOR_CODES } from "@viavinilo/contracts";

const prismaDir = __dirname;
const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");

function prismaEnum(name: string): string[] {
  const match = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  if (!match?.[1]) throw new Error(`No se encontró el enum ${name}`);
  return match[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

describe("schema de Prisma", () => {
  it("el enum JobStatus coincide con @viavinilo/contracts", () => {
    expect(prismaEnum("JobStatus")).toEqual([...JOB_STATUSES]);
  });

  it("el enum SectorCode coincide con @viavinilo/contracts", () => {
    expect(prismaEnum("SectorCode")).toEqual([...SECTOR_CODES]);
  });
});

describe("migraciones", () => {
  it("se aplican en orden sobre un Postgres vacío y crean las tablas de la E1", async () => {
    const db = new PGlite();
    const dir = join(prismaDir, "migrations");
    const migrations = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(migrations.length).toBeGreaterThan(0);

    for (const m of migrations) {
      await db.exec(readFileSync(join(dir, m, "migration.sql"), "utf8"));
    }

    const { rows } = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tables = rows.map((r) => r.table_name);
    for (const t of ["Customer", "Sector", "SectorStage", "Machine", "JobOrder", "JobFile", "JobEvent"]) {
      expect(tables).toContain(t);
    }

    // R-JOB-1: el número de orden es correlativo y único.
    await db.exec(`
      INSERT INTO "Customer" (id, "updatedAt") VALUES ('c1', now());
      INSERT INTO "Sector" (id, code, name, "updatedAt") VALUES ('s1', 'DTF', 'DTF', now());
      INSERT INTO "JobOrder" (id, "customerId", "sectorId", status, source, "updatedAt")
        VALUES ('j1', 'c1', 's1', 'RECEIVED', 'EMAIL', now()), ('j2', 'c1', 's1', 'RECEIVED', 'EMAIL', now());
    `);
    const jobs = await db.query<{ number: number }>(`SELECT number FROM "JobOrder" ORDER BY number`);
    expect(jobs.rows.map((r) => r.number)).toEqual([1, 2]);

    // Idempotencia: el mismo Message-ID no puede crear dos órdenes.
    await db.exec(
      `INSERT INTO "JobOrder" (id, "customerId", "sectorId", status, source, "sourceMessageId", "updatedAt")
       VALUES ('j3', 'c1', 's1', 'RECEIVED', 'EMAIL', '<abc@mail>', now())`,
    );
    await expect(
      db.exec(
        `INSERT INTO "JobOrder" (id, "customerId", "sectorId", status, source, "sourceMessageId", "updatedAt")
         VALUES ('j4', 'c1', 's1', 'RECEIVED', 'EMAIL', '<abc@mail>', now())`,
      ),
    ).rejects.toThrow();

    await db.close();
  }, 60_000);
});
