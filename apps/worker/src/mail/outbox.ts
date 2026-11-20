import type { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { hostingerMailboxIds, HostingerMailError, type HostingerMailConfig } from "./sources/hostinger-api";

/**
 * Cola de mails a clientes (D-049): la API los anota en `OutboundEmail` y acá se mandan **despacio**
 * (pocos por minuto), para que la casilla no quede bloqueada por spam como `dtf@` (I-22).
 * Después de enviar se borra el link del texto guardado: el link de activación no queda en la base.
 */
export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Casilla desde la que sale (respuesta desde el sector). Sin valor: la casilla de envío general. */
  from?: string | null;
  /** UID del mail original en esa casilla, para responder en el mismo hilo (D-045). */
  inReplyToUid?: number | null;
}

export type MailSender = (mail: OutgoingMail) => Promise<void>;

/** Mails por vuelta (la vuelta corre cada minuto) y espera entre uno y otro. */
export const OUTBOX = { perRun: 10, gapMs: 3000, maxAttempts: 5 } as const;

const LINK = /https?:\/\/\S+\/activar\/\S+/g;

/**
 * Envío con la API de mail de Hostinger. Sale desde la casilla del mail (respuestas desde el sector,
 * D-045) o, si no tiene, desde la casilla de envío general (MAIL_SENDER_ADDRESS, D-049).
 */
export function hostingerSender(
  config: HostingerMailConfig,
  senderAddress: string,
  fetchFn: typeof fetch = fetch,
): MailSender {
  let ids: Map<string, string> | undefined;
  return async (mail) => {
    const from = (mail.from ?? senderAddress).toLowerCase();
    ids ??= await hostingerMailboxIds(config, fetchFn);
    const mailboxId = ids.get(from);
    if (!mailboxId) {
      throw new Error(`El token de mail no tiene acceso a ${from} (D-049): hay que ampliarlo en Hostinger`);
    }
    const res = await fetchFn(`${config.baseUrl}/mailboxes/${encodeURIComponent(mailboxId)}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        displayName: "Via Vinilo",
        ...(mail.inReplyToUid ? { inReplyTo: { uid: mail.inReplyToUid, folder: "INBOX" } } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      throw new HostingerMailError(`API de mail de Hostinger: ${body.error ?? `HTTP ${res.status}`}`, res.status, body.code);
    }
  };
}

export function smtpSender(url: string, from: string): MailSender {
  const transport = nodemailer.createTransport(url);
  return async (mail) => {
    await transport.sendMail({
      from: mail.from ? `Via Vinilo <${mail.from}>` : from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      headers: { "Auto-Submitted": "auto-generated" },
    });
  };
}

/** Manda hasta `perRun` mails pendientes, de a uno. Devuelve cuántos salieron y cuántos fallaron. */
export async function sendOutbox(
  prisma: PrismaClient,
  send: MailSender,
  opts: { perRun?: number; gapMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ sent: number; failed: number }> {
  const perRun = opts.perRun ?? OUTBOX.perRun;
  const gapMs = opts.gapMs ?? OUTBOX.gapMs;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const pending = await prisma.outboundEmail.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: perRun,
  });
  let sent = 0;
  let failed = 0;
  for (const [i, mail] of pending.entries()) {
    if (i > 0) await sleep(gapMs);
    try {
      await send({ to: mail.to, subject: mail.subject, text: mail.text, from: mail.fromAddress, inReplyToUid: mail.inReplyToUid });
      await prisma.outboundEmail.update({
        where: { id: mail.id },
        data: { status: "SENT", sentAt: new Date(), text: mail.text.replace(LINK, "[link enviado]"), lastError: null },
      });
      sent++;
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
      const attempts = mail.attempts + 1;
      await prisma.outboundEmail.update({
        where: { id: mail.id },
        data: { attempts, lastError: message, status: attempts >= OUTBOX.maxAttempts ? "FAILED" : "PENDING" },
      });
      failed++;
      // Si Hostinger frena por cantidad de envíos, se corta la vuelta y se sigue en la próxima.
      if (err instanceof HostingerMailError && err.status === 429) break;
    }
  }
  return { sent, failed };
}
