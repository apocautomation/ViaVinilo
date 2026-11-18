import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

/** Mismas migraciones que la API: el schema vive en apps/api/prisma. */
const MIGRATIONS = join(__dirname, "..", "..", "api", "prisma", "migrations");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr ? resolve(addr.port) : reject(new Error("sin puerto"))));
    });
  });
}

/** Postgres en memoria con las migraciones aplicadas, accesible por TCP para Prisma (ver apps/api/test/test-db.ts). */
export async function startTestDb() {
  const db = await PGlite.create();
  for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, dir.name, "migration.sql"), "utf8"));
  }
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pool_timeout=60&pgbouncer=true`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
