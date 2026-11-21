import type { PrismaClient } from "@prisma/client";
import { attachmentsOf, isPushEndpoint, notificationPrefsSchema, pushPayloadFor, type PushPayload } from "@viavinilo/contracts";
import webpush from "web-push";

/**
 * Notificaciones push de la app de clientes (D-068). Cada mensaje que el equipo, el bot o un aviso
 * automático le deja al cliente en el chat de la app le llega también al celular, si lo aceptó.
 * No es WhatsApp (R-NOT-1): es la notificación de la propia app.
 */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** "gone": el navegador avisó que esa suscripción ya no existe (desinstaló la app o revocó el permiso). */
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<"ok" | "gone">;

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  /** Contacto que pide el estándar: "mailto:…" o la URL de la app. */
  subject: string;
}

export function webPushSender(vapid: VapidConfig): PushSender {
  return async (target, payload) => {
    try {
      await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), {
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        // Si el celular está apagado, el aviso espera hasta un día.
        TTL: 24 * 3600,
        timeout: 10_000,
      });
      return "ok";
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      throw err;
    }
  };
}

/** Un mensaje más viejo que esto ya no se notifica (por ejemplo, si el worker estuvo caído). */
const MAX_AGE_MS = 30 * 60_000;

export async function processPush(prisma: PrismaClient, send: PushSender, opts: { limit?: number; now?: Date } = {}): Promise<{ sent: number; failed: number; removed: number }> {
  const now = opts.now ?? new Date();
  const messages = await prisma.message.findMany({
    where: { direction: "OUT", channel: "APP", pushedAt: null },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 30,
    select: {
      id: true,
      subject: true,
      body: true,
      attachments: true,
      createdAt: true,
      conversation: { select: { customer: { select: { status: true, deletedAt: true, notificationPrefs: true, pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } } } } } },
    },
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const m of messages) {
    // Se marca primero: si dos workers lo leen a la vez, notifica uno solo. Un envío que falla no se repite.
    const { count } = await prisma.message.updateMany({ where: { id: m.id, pushedAt: null }, data: { pushedAt: now } });
    if (count === 0) continue;
    const customer = m.conversation.customer;
    if (!customer || customer.deletedAt || customer.status === "BLOCKED") continue;
    if (now.getTime() - m.createdAt.getTime() > MAX_AGE_MS) continue;
    const prefs = notificationPrefsSchema.safeParse(customer.notificationPrefs);
    if (prefs.success && !prefs.data.push) continue;

    const payload = pushPayloadFor({ subject: m.subject, body: m.body, attachments: attachmentsOf(m.attachments).length });
    for (const sub of customer.pushSubscriptions) {
      if (!isPushEndpoint(sub.endpoint)) continue;
      try {
        if ((await send(sub, payload)) === "gone") {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          removed++;
        } else {
          sent++;
        }
      } catch (err) {
        failed++;
        console.error("[push] no se pudo enviar:", err instanceof Error ? err.message : err);
      }
    }
  }
  return { sent, failed, removed };
}
