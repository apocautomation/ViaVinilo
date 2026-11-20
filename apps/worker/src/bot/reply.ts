import type { PrismaClient } from "@prisma/client";
import { formatJobNumber, JOB_STATUS_LABELS } from "@viavinilo/contracts";
import { fixedFlow } from "./flows";
import { fixedHandoff, handoffReply } from "./handoff";
import type { BotAnswer, ChatTurn, Llm } from "./llm";
import { buildSystemPrompt, type BotJob } from "./prompt";
import { dropNoticePromises, fixMailboxes } from "./guard";
import { toVoseo } from "./voseo";

const HISTORY = 12;

/** Avisos automáticos de estado al cliente (D-060). Sin fila = apagados. */
export const NOTICES_SETTING_KEY = "customer-notices";
export async function noticesOn(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: NOTICES_SETTING_KEY } });
  return (row?.value as { enabled?: unknown } | null)?.enabled === true;
}
const PREVIEW_CHARS = 140;
const preview = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

/**
 * Cómo decide el bot la respuesta a un mensaje (D-060, D-061). La usan el worker y la prueba de
 * punta a punta (bot-dry-run), para que lo probado sea exactamente lo que corre.
 * 1. Derivación fija a un asesor (cancelar, reclamos, precios, comprobantes, pedir una persona).
 * 2. Flujos fijos (saludo, trabajo nuevo, "¿está listo?", formatos, sucursales, tiempos).
 * 3. La IA, con controles sobre lo que escribe (vos, casillas, promesas de aviso).
 */
export async function decideAnswer(input: {
  text: string;
  firstName: string | null;
  alreadyTalking: boolean;
  noticesOn: boolean;
  jobs: BotJob[];
  turns: ChatTurn[];
  llm: Llm;
  now: Date;
}): Promise<BotAnswer & { source: "handoff" | "flow" | "ai" }> {
  const fixed = fixedHandoff(input.text);
  if (fixed) return { reply: handoffReply(input.now), handoff: true, reason: fixed, source: "handoff" };
  const flow = fixedFlow(input.text, { firstName: input.firstName, alreadyTalking: input.alreadyTalking, noticesOn: input.noticesOn, jobs: input.jobs });
  if (flow) return { reply: flow, handoff: false, reason: null, source: "flow" };
  const answer = await input.llm(input.turns);
  let reply = fixMailboxes(toVoseo(answer.reply));
  if (!input.noticesOn) reply = dropNoticePromises(reply);
  return { ...answer, reply, source: "ai" };
}

export interface BotRunResult {
  answered: number;
  handoffs: number;
  skipped: number;
  failed: number;
}

/**
 * Responde los mensajes del chat de la app que esperan al bot (D-056). Cada mensaje se toma con un
 * update condicional, así dos workers no responden dos veces. Antes de responder se vuelve a mirar:
 * - que el bot siga prendido en ese chat (es individual, D-057) y que el chat no esté derivado a un asesor;
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
    if (!conv.customer || !conv.botEnabled || conv.needsHuman || newer > 0) {
      await finish("SKIPPED");
      result.skipped++;
      continue;
    }

    const customer = conv.customer;
    // D-057: los casos que siempre van a un asesor no pasan por la IA.
    const incoming = await prisma.message.findUniqueOrThrow({ where: { id: msg.id }, select: { body: true } });
    const jobs = await prisma.jobOrder.findMany({
      where: { customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { sector: { select: { name: true } } },
    });
    const history = await prisma.message.findMany({
      // D-061: después de un "/reset", el bot solo lee desde ahí.
      where: { conversationId: conv.id, createdAt: { lte: msg.createdAt, ...(conv.botResetAt ? { gt: conv.botResetAt } : {}) } },
      orderBy: { createdAt: "desc" },
      take: HISTORY,
      select: { direction: true, channel: true, body: true, fromBot: true },
    });
    const notices = await noticesOn(prisma);
    const alreadyTalking = history.some((m) => m.direction === "OUT");
    const botJobs = jobs.map((j) => ({
      label: formatJobNumber(j.number),
      sector: j.sector.name,
      status: JOB_STATUS_LABELS[j.status],
      description: j.description,
      quotedAmount: j.quotedAmount?.toString() ?? null,
      depositRequired: j.depositRequired,
      depositPaid: j.depositPaidAt !== null,
      estimatedReadyAt: j.estimatedReadyAt,
      createdAt: j.createdAt,
    }));
    const system = buildSystemPrompt({
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.businessName || "Cliente",
      customerNumber: customer.customerNumber,
      pendingSignup: customer.status === "PENDING",
      jobs: botJobs,
      now: now(),
      // D-060: memoria por conversación. Si ya hubo una respuesta en el hilo, no se saluda de nuevo.
      alreadyTalking,
      noticesOn: notices,
    });
    const turns: ChatTurn[] = [
      { role: "system", content: system },
      ...history.reverse().map((m): ChatTurn => ({
        role: m.direction === "IN" ? "user" : "assistant",
        content: `${m.channel === "MAIL" ? "[por mail] " : ""}${m.body.slice(0, 2000)}`,
      })),
    ];

    let answer: BotAnswer;
    try {
      answer = await decideAnswer({
        text: incoming.body,
        firstName: customer.firstName,
        alreadyTalking,
        noticesOn: notices,
        jobs: botJobs,
        turns,
        llm,
        now: now(),
      });
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
