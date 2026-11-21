import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { loadConfig } from "./config";
import { openAiLlm } from "./bot/llm";
import { buildSystemPrompt } from "./bot/prompt";
import { processBotReplies } from "./bot/reply";
import { createSmtpNotifier } from "./mail/invite";
import { processNotices } from "./notices";
import { purgeOldFiles } from "./retention";
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
      const r = await sendOutbox(prisma, sender, { readFile: (key) => deps.storage.get(key) });
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

  // Bot de la app (D-056): mira cada 5 s si hay mensajes que esperan respuesta. Arranca apagado:
  // solo responde si está prendido en el ERP (general y en el chat) y hay clave de IA.
  const botQueue = new Queue(QUEUES.bot, { connection });
  const llm = config.bot ? openAiLlm(config.bot) : null;
  const botWorker = new Worker(
    QUEUES.bot,
    async () => {
      if (!llm) return;
      const r = await processBotReplies(prisma, llm);
      if (r.answered || r.handoffs || r.failed) {
        console.log(`[bot] ${r.answered} respuestas, ${r.handoffs} derivadas a un asesor, ${r.failed} con error`);
      }
    },
    { connection, concurrency: 1 },
  );
  botWorker.on("failed", (_job, err) => console.error("[bot] falló", err.message));
  if (llm) {
    await botQueue.upsertJobScheduler("bot-replies", { every: 5_000 }, { name: "reply" });
    console.log(`[worker] bot: listo con ${config.bot!.model} en ${new URL(config.bot!.baseUrl).host} (responde solo en los chats donde esté prendido)`);
    // D-057: precarga el modelo local con la parte fija del prompt, así el primer cliente no espera ~30 s.
    const warm = buildSystemPrompt({ customerName: "Cliente", customerNumber: 0, pendingSignup: false, jobs: [], now: new Date() });
    const t0 = Date.now();
    llm([{ role: "system", content: warm }, { role: "user", content: "hola" }])
      .then(() => console.log(`[bot] modelo listo en ${Math.round((Date.now() - t0) / 1000)} s`))
      .catch((err: unknown) => console.error("[bot] no se pudo precargar el modelo:", err instanceof Error ? err.message : err));
  } else {
    await botQueue.removeJobScheduler("bot-replies");
    console.log("[worker] bot: sin IA configurada (BOT_API_URL u OPENAI_API_KEY), no responde");
  }

  // Avisos de estado al cliente (D-060): cada 30 s. Solo hacen algo si se prendieron en el ERP.
  const noticesQueue = new Queue(QUEUES.notices, { connection });
  const noticesWorker = new Worker(
    QUEUES.notices,
    async () => {
      const r = await processNotices(prisma);
      if (r.sent) console.log(`[avisos] ${r.sent} avisos de estado a clientes`);
    },
    { connection, concurrency: 1 },
  );
  noticesWorker.on("failed", (_job, err) => console.error("[avisos] falló", err.message));
  await noticesQueue.upsertJobScheduler("status-notices", { every: 30_000 }, { name: "notices" });

  // Retención (D-015): todos los días a las 03:30 de Salta borra los archivos de órdenes entregadas hace más de 30 días.
  const retentionQueue = new Queue(QUEUES.fileRetention, { connection });
  const retentionWorker = new Worker(
    QUEUES.fileRetention,
    async () => {
      const r = await purgeOldFiles(prisma, deps.storage);
      if (r.purged || r.failed) console.log(`[retención] ${r.purged} archivos borrados de ${r.jobs} órdenes, ${r.failed} con error`);
    },
    { connection, concurrency: 1 },
  );
  retentionWorker.on("failed", (_job, err) => console.error("[retención] falló", err.message));
  await retentionQueue.upsertJobScheduler("file-retention", { pattern: "30 3 * * *", tz: "America/Argentina/Salta" }, { name: "purge" });

  const shutdown = async () => {
    console.log("[worker] cerrando…");
    await mailWorker.close();
    await mailQueue.close();
    await outboxWorker.close();
    await outboxQueue.close();
    await botWorker.close();
    await noticesWorker.close();
    await retentionWorker.close();
    await retentionQueue.close();
    await noticesQueue.close();
    await botQueue.close();
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
