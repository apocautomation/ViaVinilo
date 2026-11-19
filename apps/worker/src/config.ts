import { SECTOR_CODES, type SectorCode } from "@viavinilo/contracts";
import type { ImapCredentials } from "./mail/sources/imap";

export type MailSource = "imap" | "mailhog" | "off";

export interface WorkerConfig {
  redisUrl: string;
  storageDir: string;
  mailSource: MailSource;
  pollEveryMs: number;
  mailhogUrl: string;
  /** Credenciales IMAP por sector. Los sectores sin credenciales no se leen. */
  imap: Partial<Record<SectorCode, ImapCredentials>>;
  smtp: { url: string; from: string; contactUrl: string };
}

/** Lee la configuración del entorno. Nunca hay credenciales en el código (CLAUDE.md). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const mailSource = (env.MAIL_SOURCE ?? "off") as MailSource;
  if (!["imap", "mailhog", "off"].includes(mailSource)) {
    throw new Error(`MAIL_SOURCE inválido: ${mailSource} (usar imap, mailhog u off)`);
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
    smtp: {
      url: env.SMTP_URL ?? "smtp://localhost:1025",
      from: env.SMTP_FROM ?? "Via Vinilo <no-responder@viavinilo.local>",
      contactUrl: env.SUPPORT_WHATSAPP_URL ?? "",
    },
  };
}
