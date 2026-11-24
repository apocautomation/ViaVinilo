import type { PrismaClient } from "@prisma/client";
import { formatJobNumber, help, notificationPrefsSchema, type SectorCode } from "@viavinilo/contracts";
import { NOTICES_SETTING_KEY } from "./bot/reply";

/**
 * Avisos automáticos de estado al cliente (D-060): por el chat de la app y por mail.
 * Nunca por WhatsApp (R-NOT-1). Arrancan apagados; se prenden desde el ERP y solo avisan los
 * cambios que pasan desde ese momento (no se manda nada viejo de golpe).
 */
export const NOTICE_STATUSES = ["RECEIVED", "FILE_ERROR", "QUOTED", "READY"] as const;

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const PREVIEW_CHARS = 140;

/** DTF Textil, DTF UV y TPU se retiran y se pagan en la sucursal Centro; el resto, en la planta de Av. Chile. */
const isCentro = (code: SectorCode) => code === "DTF" || code === "DTF_UV" || code === "TPU";

export interface NoticeJob {
  number: number;
  description: string | null;
  sector: { code: SectorCode; name: string };
  quotedAmount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
}

/** Texto del aviso. Lo mismo va por el chat y por mail. */
export function noticeText(
  status: (typeof NOTICE_STATUSES)[number],
  job: NoticeJob,
  opts: { firstName: string | null; reason?: string | null; resent?: boolean },
): { subject: string; text: string } {
  const label = formatJobNumber(job.number);
  const what = job.description ? ` (${job.description})` : "";
  const hi = opts.firstName ? `Hola ${opts.firstName}!` : "¡Hola!";
  switch (status) {
    case "RECEIVED":
      return {
        subject: `Recibimos tu archivo · ${label}`,
        text: `${hi} Recibimos ${opts.resent ? "el archivo corregido" : "tu archivo"} para el pedido ${label}${what} de ${job.sector.name}. Lo revisamos y te pasamos el precio.`,
      };
    case "FILE_ERROR":
      return {
        subject: `Hay que corregir el archivo · ${label}`,
        text: `${hi} El archivo del pedido ${label}${what} tiene un problema${opts.reason ? `: ${opts.reason}` : ""}. Mandalo corregido por mail a la casilla de ${job.sector.name} y lo seguimos.`,
      };
    case "QUOTED": {
      const price = job.quotedAmount ? ars.format(Number(job.quotedAmount)) : null;
      const pay = help.PAYMENTS[isCentro(job.sector.code) ? 1 : 0]!;
      const deposit = job.depositRequired
        ? ` Para empezar necesitamos la seña${job.depositAmount ? ` de ${ars.format(Number(job.depositAmount))}` : " del 50%"}. Pagás por ${pay.method}: ${pay.lines.join(" · ")}. Mandanos el comprobante por el chat de la app.`
        : " Ya entra a producción.";
      return {
        subject: `Tu pedido está cotizado · ${label}`,
        text: `${hi} Tu pedido ${label}${what} está cotizado${price ? `: ${price}` : ""}.${deposit}`,
      };
    }
    case "READY": {
      const b = help.BRANCHES[isCentro(job.sector.code) ? 1 : 0]!;
      return {
        subject: `Tu pedido está listo para retirar · ${label}`,
        text: `${hi} Tu pedido ${label}${what} está terminado y listo para retirar en ${b.name}, ${b.address} (${b.hours.map((h) => `${h.days} ${h.time}`).join("; ")}). Si lo retira un cadete, tiene que entrar al local.`,
      };
    }
  }
}

async function noticesSince(prisma: PrismaClient): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: NOTICES_SETTING_KEY } });
  const v = row?.value as { enabled?: unknown; since?: unknown } | null;
  if (v?.enabled !== true) return null;
  return typeof v.since === "string" ? new Date(v.since) : (row?.updatedAt ?? new Date());
}

export async function processNotices(prisma: PrismaClient, opts: { limit?: number } = {}): Promise<{ sent: number }> {
  const since = await noticesSince(prisma);
  if (!since) return { sent: 0 };
  const events = await prisma.jobEvent.findMany({
    where: { notifiedCustomer: false, createdAt: { gte: since }, toStatus: { in: [...NOTICE_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 20,
    include: {
      reason: { select: { label: true } },
      job: {
        include: {
          sector: { select: { code: true, name: true } },
          customer: { include: { emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } } },
        },
      },
    },
  });

  let sent = 0;
  for (const ev of events) {
    // Se marca primero: si dos workers lo leen a la vez, avisa uno solo.
    const { count } = await prisma.jobEvent.updateMany({ where: { id: ev.id, notifiedCustomer: false }, data: { notifiedCustomer: true } });
    if (count === 0) continue;
    const customer = ev.job.customer;
    if (!customer || customer.deletedAt || customer.status === "BLOCKED") continue;

    const { subject, text } = noticeText(
      ev.toStatus as (typeof NOTICE_STATUSES)[number],
      {
        number: ev.job.number,
        description: ev.job.description,
        sector: { code: ev.job.sector.code as SectorCode, name: ev.job.sector.name },
        quotedAmount: ev.job.quotedAmount?.toString() ?? null,
        depositRequired: ev.job.depositRequired,
        depositAmount: ev.job.depositAmount?.toString() ?? null,
      },
      { firstName: customer.firstName, reason: [ev.reason?.label, ev.note?.replace(/^Control automático: /, "")].filter(Boolean).join(". ") || null, resent: ev.fromStatus === "FILE_ERROR" },
    );
    const prefs = notificationPrefsSchema.safeParse(customer.notificationPrefs);
    const wantsEmail = prefs.success ? prefs.data.email : true;
    const email = customer.emails[0]?.email;

    await prisma.$transaction(async (tx) => {
      const conv =
        (await tx.conversation.findUnique({ where: { customerId: customer.id }, select: { id: true } })) ??
        (await tx.conversation.create({ data: { customerId: customer.id }, select: { id: true } }));
      const msg = await tx.message.create({
        data: { conversationId: conv.id, direction: "OUT", channel: "APP", subject: "Aviso automático", body: text, jobId: ev.jobId },
      });
      await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: msg.createdAt, lastMessagePreview: text.replace(/\s+/g, " ").slice(0, PREVIEW_CHARS), customerUnread: { increment: 1 } },
      });
      if (email && wantsEmail) {
        await tx.outboundEmail.create({ data: { to: email, subject: `Via Vinilo · ${subject}`, text, kind: "status-notice", customerId: customer.id } });
      }
    });
    sent++;
  }
  return { sent };
}
