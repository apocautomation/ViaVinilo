import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const MIGRATIONS = join(__dirname, "..", "prisma", "migrations");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr ? resolve(addr.port) : reject(new Error("sin puerto"))));
    });
  });
}

/**
 * Postgres en memoria (PGlite) con las migraciones aplicadas, expuesto por TCP para que Prisma
 * se conecte como a un Postgres común. Una sola conexión: Prisma usa connection_limit=1.
 */
export async function startTestDb() {
  const db = await PGlite.create();
  for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, dir.name, "migration.sql"), "utf8"));
  }
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  // PGlite tiene una única sesión compartida por todas las conexiones: pgbouncer=true evita que
  // Prisma deje sentencias preparadas que choquen con las de una conexión anterior.
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30&pgbouncer=true`;
  return {
    url,
    db,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
