import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { createSmtpNotifier } from "./mail/invite";
import { hostingerSender, sendOutbox, smtpSender, type MailSender } from "./mail/outbox";
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

  // Mails a clientes en cola (D-049): salen despacio, de a pocos por minuto.
  const sender: MailSender | null =
    config.hostinger && config.mailSenderAddress
      ? hostingerSender(config.hostinger, config.mailSenderAddress)
      : config.smtp.url.trim()
        ? smtpSender(config.smtp.url, config.smtp.from)
        : null;
  const outboxQueue = new Queue(QUEUES.outbox, { connection });
  const outboxWorker = new Worker(
    QUEUES.outbox,
    async () => {
      if (!sender) return;
      const r = await sendOutbox(prisma, sender);
      if (r.sent || r.failed) console.log(`[outbox] ${r.sent} mails enviados, ${r.failed} con error`);
    },
    { connection, concurrency: 1 },
  );
  outboxWorker.on("failed", (_job, err) => console.error("[outbox] falló el envío", err.message));
  if (sender) {
    await outboxQueue.upsertJobScheduler("send-outbox", { every: 60_000 }, { name: "send" });
    console.log(`[worker] mails a clientes: salen desde ${config.mailSenderAddress ?? "SMTP"}`);
  } else {
    await outboxQueue.removeJobScheduler("send-outbox");
    console.log("[worker] mails a clientes: sin casilla de envío (MAIL_SENDER_ADDRESS o SMTP_URL); quedan en cola");
  }

  const shutdown = async () => {
    console.log("[worker] cerrando…");
    await mailWorker.close();
    await mailQueue.close();
    await outboxWorker.close();
    await outboxQueue.close();
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
