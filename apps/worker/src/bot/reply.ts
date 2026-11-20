import type { PrismaClient } from "@prisma/client";
import { formatJobNumber, JOB_STATUS_LABELS } from "@viavinilo/contracts";
import type { ChatTurn, Llm } from "./llm";
import { buildSystemPrompt } from "./prompt";

/** Clave del interruptor general del bot en AppSetting (D-056). Sin fila = apagado. */
export const BOT_SETTING_KEY = "bot";

export async function isBotOn(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: BOT_SETTING_KEY } });
  return (row?.value as { enabled?: unknown } | null)?.enabled === true;
}

const HISTORY = 12;
const PREVIEW_CHARS = 140;
const preview = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

export interface BotRunResult {
  answered: number;
  handoffs: number;
  skipped: number;
  failed: number;
}

/**
 * Responde los mensajes del chat de la app que esperan al bot (D-056). Cada mensaje se toma con un
 * update condicional, así dos workers no responden dos veces. Antes de responder se vuelve a mirar:
 * - que el bot siga prendido (general y en ese chat) y que el chat no esté derivado a un asesor;
 * - que nadie del equipo haya respondido después;
 * - que no haya un mensaje más nuevo del cliente: se responde solo el último, con todo el hilo.
 */
export async function processBotReplies(
  prisma: PrismaClient,
  llm: Llm,
  opts: { limit?: number; now?: () => Date } = {},
): Promise<BotRunResult> {
  const now = opts.now ?? (() => new Date());
  const result: BotRunResult = { answered: 0, handoffs: 0, skipped: 0, failed: 0 };
  const pending = await prisma.message.findMany({
    where: { botStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 5,
    select: { id: true, conversationId: true, createdAt: true },
  });

  for (const msg of pending) {
    const { count } = await prisma.message.updateMany({ where: { id: msg.id, botStatus: "PENDING" }, data: { botStatus: "ANSWERING" } });
    if (count === 0) continue;
    const finish = (botStatus: "ANSWERED" | "HANDOFF" | "SKIPPED" | "ERROR") =>
      prisma.message.update({ where: { id: msg.id }, data: { botStatus } });

    const conv = await prisma.conversation.findUniqueOrThrow({
      where: { id: msg.conversationId },
      include: { customer: { select: { id: true, customerNumber: true, firstName: true, lastName: true, businessName: true, status: true } } },
    });
    const newer = await prisma.message.count({
      where: { conversationId: conv.id, createdAt: { gt: msg.createdAt }, OR: [{ direction: "OUT" }, { direction: "IN", channel: "APP" }] },
    });
    if (!conv.customer || !conv.botEnabled || conv.needsHuman || newer > 0 || !(await isBotOn(prisma))) {
      await finish("SKIPPED");
      result.skipped++;
      continue;
    }

    const customer = conv.customer;
    const jobs = await prisma.jobOrder.findMany({
      where: { customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { sector: { select: { name: true } } },
    });
    const history = await prisma.message.findMany({
      where: { conversationId: conv.id, createdAt: { lte: msg.createdAt } },
      orderBy: { createdAt: "desc" },
      take: HISTORY,
      select: { direction: true, channel: true, body: true, fromBot: true },
    });
    const system = buildSystemPrompt({
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.businessName || "Cliente",
      customerNumber: customer.customerNumber,
      pendingSignup: customer.status === "PENDING",
      jobs: jobs.map((j) => ({
        label: formatJobNumber(j.number),
        sector: j.sector.name,
        status: JOB_STATUS_LABELS[j.status],
        description: j.description,
        quotedAmount: j.quotedAmount?.toString() ?? null,
        depositRequired: j.depositRequired,
        depositPaid: j.depositPaidAt !== null,
        estimatedReadyAt: j.estimatedReadyAt,
        createdAt: j.createdAt,
      })),
      now: now(),
    });
    const turns: ChatTurn[] = [
      { role: "system", content: system },
      ...history.reverse().map((m): ChatTurn => ({
        role: m.direction === "IN" ? "user" : "assistant",
        content: `${m.channel === "MAIL" ? "[por mail] " : ""}${m.body.slice(0, 2000)}`,
      })),
    ];

    let answer;
    try {
      answer = await llm(turns);
    } catch (err) {
      // Sin respuesta del bot el mensaje queda para el equipo, como si el bot estuviera apagado.
      console.error(`[bot] no pudo responder en la conversación ${conv.id}:`, err instanceof Error ? err.message : err);
      await finish("ERROR");
      result.failed++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const out = await tx.message.create({
        data: { conversationId: conv.id, direction: "OUT", channel: "APP", body: answer.reply, fromBot: true },
      });
      await tx.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: out.createdAt,
          lastMessagePreview: preview(answer.reply),
          customerUnread: { increment: 1 },
          // El mensaje del cliente sigue sin leer para el equipo: mientras el bot es nuevo, nadie deja de verlo.
          // Si deriva, además el bot se apaga en ese chat y el chat queda marcado "Pide asesor".
          ...(answer.handoff
            ? { needsHuman: true, needsHumanReason: answer.reason?.slice(0, 300) ?? "El bot derivó a un asesor", botEnabled: false }
            : {}),
        },
      });
      await tx.message.update({ where: { id: msg.id }, data: { botStatus: answer.handoff ? "HANDOFF" : "ANSWERED" } });
    });
    if (answer.handoff) result.handoffs++;
    else result.answered++;
  }
  return result;
}
