import type { PrismaClient } from "@prisma/client";
import { formatJobNumber, JOB_STATUS_LABELS, SECTOR_CODES } from "@viavinilo/contracts";
import { ASK_MATERIAL, boardFor, fixedFlow, isQuestion, isThanks, serviceFor, toolFor, type ExtraBoard } from "./flows";
import { fixedHandoff, handoffReply } from "./handoff";
import type { BotAnswer, ChatTurn, Llm } from "./llm";
import { buildAgentPrompt, type BotJob } from "./prompt";
import { buildToolKit } from "./tools";
import { dropNoticePromises, dropSentencesWith, fixMailboxes, plainText, stripToolText } from "./guard";
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
 * Cómo decide el bot la respuesta a un mensaje (D-060, D-061, D-097). La usan el worker y la prueba de
 * punta a punta (bot-dry-run), para que lo probado sea exactamente lo que corre.
 * 1. Derivación fija a un asesor (cancelar, reclamos, precios, comprobantes, pedir una persona).
 * 2. La IA local responde y pide los datos con herramientas (pedidos, servicios, sucursales, pagos),
 *    como el agente de Trip. Controles sobre lo que escribe: vos, casillas, promesas de aviso, repetir.
 * 3. Respaldo fijo: si la IA falla, o contesta sobre un pedido o un archivo sin haberlo consultado,
 *    va la respuesta armada con los datos del sistema (los flujos fijos de D-060).
 */
export async function decideAnswer(input: {
  text: string;
  firstName: string | null;
  alreadyTalking: boolean;
  noticesOn: boolean;
  jobs: BotJob[];
  boards?: ExtraBoard[];
  turns: ChatTurn[];
  llm: Llm;
  now: Date;
}): Promise<BotAnswer & { source: "handoff" | "flow" | "ai"; tools?: string[] }> {
  const fixed = fixedHandoff(input.text);
  if (fixed) return { reply: handoffReply(input.now), handoff: true, reason: fixed, source: "handoff" };
  const fixedReply = fixedFlow(input.text, {
    firstName: input.firstName,
    alreadyTalking: input.alreadyTalking,
    noticesOn: input.noticesOn,
    jobs: input.jobs,
    boards: input.boards,
    now: input.now,
  });
  // D-099: si el cliente arrancó con "hola" y es el primer mensaje, la respuesta armada también saluda.
  const greets = /^\s*(hola+|buenas?( tardes| noches| d[ií]as)?|buen d[ií]a|holis)\b/i.test(input.text) && !input.alreadyTalking;
  const flow = fixedReply && greets && !/^¡Hola/.test(fixedReply) ? `¡Hola${input.firstName ? ` ${input.firstName}` : ""}! ${fixedReply}` : fixedReply;
  if (flow && isThanks(input.text)) return { reply: flow, handoff: false, reason: null, source: "flow" };
  const kit = buildToolKit({ jobs: input.jobs, boards: input.boards, noticesOn: input.noticesOn, now: input.now });
  let answer: BotAnswer;
  try {
    answer = await input.llm(input.turns, kit);
  } catch (err) {
    // D-097: sin IA (caída, lenta o sin terminar), contesta lo fijo si hay; si no, queda para el equipo.
    if (flow) return { reply: flow, handoff: false, reason: null, source: "flow", tools: kit.used };
    throw err;
  }
  // D-098: si escribió la llamada a una herramienta en el texto, se saca; si era derivar, se deriva.
  const stripped = stripToolText(answer.reply);
  if (stripped.handoff && !answer.handoff) {
    return { reply: handoffReply(input.now), handoff: true, reason: stripped.handoff, source: "handoff", tools: [...kit.used, "derivar_a_asesor"] };
  }
  if (!answer.handoff) {
    // D-097, D-098: cada pregunta tiene su herramienta. Si la IA no la usó, su respuesta no sale de los
    // datos del sistema: va la respuesta armada. Si no hay armada y no usó ninguna, lo ve un asesor.
    const needed = toolFor(input.text, input.jobs);
    if (needed && !kit.used.includes(needed) && flow) return { reply: flow, handoff: false, reason: null, source: "flow", tools: kit.used };
    if (!kit.used.length && isQuestion(input.text) && !flow) {
      return { reply: handoffReply(input.now), handoff: true, reason: "Pregunta que el bot no puede responder con datos del sistema", source: "handoff", tools: kit.used };
    }
  }
  if (!stripped.text) {
    if (flow) return { reply: flow, handoff: false, reason: null, source: "flow", tools: kit.used };
    throw new Error("El modelo respondió solo con una herramienta");
  }
  let reply = plainText(fixMailboxes(toVoseo(stripped.text)));
  // D-101: el modelo a veces arranca en minúscula ("hola Lucía").
  reply = reply.replace(/^([¡¿"]?)(\p{Ll})/u, (_m, p: string, c: string) => p + c.toUpperCase());
  // D-092: si la IA va a repetir lo mismo que ya dijo, no está entendiendo: lo ve un asesor.
  const same = (t: string) => t.toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();
  const said = input.turns.filter((t) => t.role === "assistant").slice(-4).map((t) => same(t.content));
  if (!answer.handoff && said.includes(same(reply))) {
    return { reply: handoffReply(input.now), handoff: true, reason: "El bot iba a repetir la misma respuesta", source: "handoff" };
  }
  if (!input.noticesOn) reply = dropNoticePromises(reply);
  // D-061: si el cliente no dijo el material, la IA no elige casilla (tendía a mandar todo a dtf@).
  if (/@viavinilo\.com/i.test(reply) && !kit.used.includes("info_servicio") && !serviceFor(input.text) && !boardFor(input.text, input.boards)) {
    reply = dropSentencesWith(reply, /@viavinilo\.com/i);
    if (!reply) return { reply: ASK_MATERIAL, handoff: false, reason: null, source: "flow" };
  }
  return { ...answer, reply, source: "ai", tools: kit.used };
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
    // D-064: los tableros creados desde el ERP también los conoce el bot.
    const boards: ExtraBoard[] = (
      await prisma.sector.findMany({ where: { active: true, code: { notIn: [...SECTOR_CODES] } }, select: { name: true, inboxEmail: true } })
    ).map((s) => ({ name: s.name, email: s.inboxEmail }));
    const jobs = await prisma.jobOrder.findMany({
      where: { customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        sector: { select: { name: true } },
        // D-092: el motivo del último error de archivo, para decírselo al cliente.
        events: { where: { toStatus: "FILE_ERROR" }, orderBy: { createdAt: "desc" }, take: 1, select: { note: true, reason: { select: { label: true } } } },
        // D-094: para decir si el pedido tiene o no su archivo.
        files: { where: { deletedAt: null, purgedAt: null }, orderBy: { createdAt: "desc" }, select: { filename: true } },
      },
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
      depositAmount: j.depositAmount?.toString() ?? null,
      estimatedReadyAt: j.estimatedReadyAt,
      createdAt: j.createdAt,
      files: j.files.map((f) => f.filename),
      hasLinks: j.externalLinks.length > 0,
      fileIssue:
        j.status === "FILE_ERROR"
          ? [j.events[0]?.reason?.label, j.events[0]?.note?.replace(/^Control automático: /, "")]
              .filter(Boolean)
              .join(". ")
              .replace(/[.\s]+$/, "")
              .slice(0, 260) || null
          : null,
      fileCheck: j.status === "RECEIVED" ? ((j.fileCheck as { verdict?: BotJob["fileCheck"] } | null)?.verdict ?? null) : null,
      pickupBranch: j.pickupBranch,
    }));
    const system = buildAgentPrompt({
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.businessName || "Cliente",
      customerNumber: customer.customerNumber,
      pendingSignup: customer.status === "PENDING",
      jobs: botJobs,
      now: now(),
      // D-060: memoria por conversación. Si ya hubo una respuesta en el hilo, no se saluda de nuevo.
      alreadyTalking,
      noticesOn: notices,
      boards,
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
        boards,
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
