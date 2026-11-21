import { SECTOR_CODES, type SectorCode } from "@viavinilo/contracts";
import type { LlmConfig } from "./bot/llm";
import type { VapidConfig } from "./push";
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
  /** IA del bot de la app (D-056, D-057). Sin IA configurada el bot no responde aunque esté prendido. */
  bot: LlmConfig | null;
  /** Claves de las notificaciones push de la app (D-068). Sin claves no se manda ninguna. */
  push: VapidConfig | null;
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
    bot: botConfig(env),
    push: pushConfig(env),
  };
}

/**
 * D-057: el bot corre en local con Ollama (BOT_API_URL=http://ollama:11434/v1, sin clave).
 * OpenAI queda como respaldo si se carga OPENAI_API_KEY y no hay BOT_API_URL.
 */
export function botConfig(env: NodeJS.ProcessEnv): LlmConfig | null {
  const baseUrl = env.BOT_API_URL?.trim();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (baseUrl) return { baseUrl, apiKey: apiKey || "ollama", model: env.BOT_MODEL?.trim() || "qwen2.5:3b" };
  if (apiKey) return { baseUrl: "https://api.openai.com/v1", apiKey, model: env.BOT_MODEL?.trim() || "gpt-4.1-mini" };
  return null;
}

/**
 * D-068: claves VAPID de las notificaciones push. Se generan una sola vez con
 * `pnpm --filter @viavinilo/worker exec web-push generate-vapid-keys` y van por entorno.
 */
export function pushConfig(env: NodeJS.ProcessEnv): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || env.APP_PUBLIC_URL?.trim() || "https://viavinilo.tech" };
}
