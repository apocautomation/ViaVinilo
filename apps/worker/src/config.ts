import { SECTOR_CODES, type SectorCode } from "@viavinilo/contracts";
import type { LlmConfig } from "./bot/llm";
import { HOSTINGER_MAIL_API, type HostingerMailConfig } from "./mail/sources/hostinger-api";
import type { ImapCredentials } from "./mail/sources/imap";

export type MailSource = "hostinger-api" | "imap" | "mailhog" | "off";

export interface WorkerConfig {
  redisUrl: string;
  storageDir: string;
  mailSource: MailSource;
  pollEveryMs: number;
  mailhogUrl: string;
  /** Credenciales IMAP por sector. Los sectores sin credenciales no se leen. */
  imap: Partial<Record<SectorCode, ImapCredentials>>;
  /** API de mail de Hostinger (D-043). Solo con MAIL_SOURCE=hostinger-api. */
  hostinger: HostingerMailConfig | null;
  /** Casilla desde la que salen los mails a clientes con la API de Hostinger (D-049). */
  mailSenderAddress: string | null;
  smtp: { url: string; from: string; contactUrl: string };
  /** IA del bot de la app (D-056). Sin clave el bot no responde aunque esté prendido. */
  bot: LlmConfig | null;
}

/** Lee la configuración del entorno. Nunca hay credenciales en el código (CLAUDE.md). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const mailSource = (env.MAIL_SOURCE ?? "off") as MailSource;
  if (!["hostinger-api", "imap", "mailhog", "off"].includes(mailSource)) {
    throw new Error(`MAIL_SOURCE inválido: ${mailSource} (usar hostinger-api, imap, mailhog u off)`);
  }
  const hostingerToken = env.HOSTINGER_MAIL_API_TOKEN?.trim();
  if (mailSource === "hostinger-api" && !hostingerToken) {
    throw new Error("MAIL_SOURCE=hostinger-api necesita HOSTINGER_MAIL_API_TOKEN");
  }

  const imap: WorkerConfig["imap"] = {};
  for (const code of SECTOR_CODES) {
    const user = env[`IMAP_${code}_USER`];
    const pass = env[`IMAP_${code}_PASS`];
    if (user && pass) {
      imap[code] = {
        host: env.IMAP_HOST ?? "imap.hostinger.com",
        port: Number(env.IMAP_PORT ?? 993),
        secure: (env.IMAP_SECURE ?? "true") !== "false",
        user,
        pass,
      };
    }
  }

  return {
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    storageDir: env.STORAGE_DIR ?? "./storage",
    mailSource,
    pollEveryMs: Number(env.MAIL_POLL_SECONDS ?? 60) * 1000,
    mailhogUrl: env.MAILHOG_URL ?? "http://localhost:8025",
    imap,
    hostinger: hostingerToken
      ? { token: hostingerToken, baseUrl: env.HOSTINGER_MAIL_API_URL?.trim() || HOSTINGER_MAIL_API }
      : null,
    mailSenderAddress: env.MAIL_SENDER_ADDRESS?.trim().toLowerCase() || null,
    smtp: {
      url: env.SMTP_URL ?? "smtp://localhost:1025",
      from: env.SMTP_FROM ?? "Via Vinilo <no-responder@viavinilo.local>",
      contactUrl: env.SUPPORT_WHATSAPP_URL ?? "",
    },
    bot: env.OPENAI_API_KEY?.trim()
      ? {
          apiKey: env.OPENAI_API_KEY.trim(),
          baseUrl: env.BOT_API_URL?.trim() || "https://api.openai.com/v1",
          model: env.BOT_MODEL?.trim() || "gpt-4.1-mini",
        }
      : null,
  };
}
