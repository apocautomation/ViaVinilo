import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { JOB_STATUSES, SECTOR_CODES } from "@viavinilo/contracts";
import { SECTOR_VARIANTS } from "./seed-data";

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

  it("D-064: el código de tablero es texto (se crean tableros desde el ERP); los de base siguen en contracts (D-082: 11 con los sub-servicios y TPU)", () => {
    expect(schema).not.toMatch(/enum SectorCode/);
    expect(SECTOR_CODES).toHaveLength(11);
  });
});

describe("migraciones", () => {
  it("D-064: pasar el código de tablero a texto conserva los tableros y sus pedidos", async () => {
    const db = new PGlite();
    const dir = join(prismaDir, "migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const cut = all.indexOf("20261121120000_sector_code_text");
    expect(cut).toBeGreaterThan(0);
    for (const m of all.slice(0, cut)) await db.exec(readFileSync(join(dir, m, "migration.sql"), "utf8"));
    await db.exec(`
      INSERT INTO "Customer" (id, "updatedAt") VALUES ('c1', now());
      INSERT INTO "Sector" (id, code, name, "updatedAt") VALUES ('s1', 'DTF', 'DTF', now()), ('s2', 'GRAN_FORMATO', 'Gran Formato', now());
      INSERT INTO "JobOrder" (id, "customerId", "sectorId", status, source, "updatedAt") VALUES ('j1', 'c1', 's2', 'RECEIVED', 'EMAIL', now());
    `);
    await db.exec(readFileSync(join(dir, all[cut]!, "migration.sql"), "utf8"));
    const sectors = await db.query<{ id: string; code: string }>(`SELECT id, code FROM "Sector" ORDER BY id`);
    expect(sectors.rows).toEqual([{ id: "s1", code: "DTF" }, { id: "s2", code: "GRAN_FORMATO" }]);
    // Sigue siendo único y ahora acepta un código nuevo.
    await db.exec(`INSERT INTO "Sector" (id, code, name, "updatedAt") VALUES ('s3', 'TPU', 'TPU', now())`);
    await expect(db.exec(`INSERT INTO "Sector" (id, code, name, "updatedAt") VALUES ('s4', 'TPU', 'Otro', now())`)).rejects.toThrow();
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "JobOrder" WHERE "sectorId" = 's2'`)).rows[0]!.n).toBe(1);
  });


  it("D-117, D-118: las migraciones de opciones cargan en producción lo mismo que el seed", async () => {
    const db = new PGlite();
    const dir = join(prismaDir, "migrations");
    const all = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    const cut = all.indexOf("20261126180000_gran_formato_materials");
    expect(cut).toBeGreaterThan(0);
    for (const m of all.slice(0, cut)) await db.exec(readFileSync(join(dir, m, "migration.sql"), "utf8"));
    // Producción ya tiene los tableros: las migraciones solo agregan sus opciones.
    const sectors = ["LATEX", "ECOSOLVENTE", "UV_ROLLO", "UV_RIGIDOS"];
    for (const code of sectors) {
      await db.exec(`INSERT INTO "Sector" (id, code, name, "updatedAt") VALUES ('${code}', '${code}', '${code}', now())`);
    }
    for (const m of all.slice(cut)) await db.exec(readFileSync(join(dir, m, "migration.sql"), "utf8"));
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT "sectorId" AS sector, code, name, "tangoSku", width, "usableWidth", "sortOrder"
       FROM "SectorVariant" ORDER BY "sectorId", "sortOrder"`,
    );
    const seeded = SECTOR_VARIANTS.filter((v) => sectors.includes(v.sector));
    const bySector = (list: { sector: string; sortOrder: number }[]) =>
      [...list].sort((a, b) => a.sector.localeCompare(b.sector) || a.sortOrder - b.sortOrder);
    expect(rows).toEqual(bySector(seeded));
  });

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
