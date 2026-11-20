import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { createSmtpNotifier } from "./mail/invite";
import { pollAllMailboxes } from "./mail/poll";
import { QUEUES } from "./queues";
import { LocalDiskStorage } from "./storage";

async function main() {
  const config = loadConfig();
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  const prisma = new PrismaClient();
  const deps = {
    prisma,
    storage: new LocalDiskStorage(config.storageDir),
    notifier: createSmtpNotifier(config.smtp),
  };

  const mailQueue = new Queue(QUEUES.mailIngest, { connection });
  // Un solo procesador a la vez: dos lecturas simultáneas de la misma casilla no aportan nada.
  const mailWorker = new Worker(QUEUES.mailIngest, () => pollAllMailboxes(config, deps), {
    connection,
    concurrency: 1,
  });
  mailWorker.on("failed", (_job, err) => console.error("[mail] falló la lectura de casillas", err.message));

  if (config.mailSource === "off") {
    await mailQueue.removeJobScheduler("poll-mailboxes");
    console.log("[worker] lectura de mails apagada (MAIL_SOURCE=off)");
  } else {
    await mailQueue.upsertJobScheduler("poll-mailboxes", { every: config.pollEveryMs }, { name: "poll" });
    const sectors =
      config.mailSource === "imap"
        ? Object.keys(config.imap).join(", ") || "ninguno"
        : config.mailSource === "hostinger-api"
          ? "las casillas de sector que ve el token"
          : "todos";
    console.log(
      `[worker] leyendo mails desde ${config.mailSource} cada ${config.pollEveryMs / 1000} s (sectores: ${sectors})`,
    );
  }

  const shutdown = async () => {
    console.log("[worker] cerrando…");
    await mailWorker.close();
    await mailQueue.close();
    await prisma.$disconnect();
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
