import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUES } from "./queues";

async function main() {
  const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const queues = Object.values(QUEUES).map((name) => new Queue(name, { connection }));
  console.log(`[worker] conectado a Redis; colas: ${Object.values(QUEUES).join(", ")}`);

  const shutdown = async () => {
    console.log("[worker] cerrando…");
    await Promise.all(queues.map((q) => q.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] error al iniciar", err);
  process.exit(1);
});
