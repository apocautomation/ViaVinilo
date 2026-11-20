import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { openAiLlm, parseAnswer, type ChatTurn, type Llm } from "../src/bot/llm";
import { decideAnswer, processBotReplies } from "../src/bot/reply";
import { startTestDb } from "./test-db";

let prisma: PrismaClient;
let stopDb: () => Promise<void>;
let customerId: string;
let conversationId: string;
let sectorId: string;

beforeAll(async () => {
  const db = await startTestDb();
  stopDb = db.stop;
  prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
  const sector = await prisma.sector.create({ data: { code: "DTF", name: "DTF", inboxEmail: "dtf@viavinilo.test" } });
  sectorId = sector.id;
  const customer = await prisma.customer.create({
    data: { status: "ACTIVE", firstName: "Ana", lastName: "Gómez", dni: "28123456", emails: { create: { email: "ana@cliente.test", isPrimary: true } } },
  });
  customerId = customer.id;
  await prisma.jobOrder.create({
    data: { customerId, sectorId, status: "READY", source: "EMAIL", description: "Remeras logo" },
  });
});

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  // Todos los chats arrancan con el bot apagado (D-056).
  const conv = await prisma.conversation.create({ data: { customerId } });
  conversationId = conv.id;
});

afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

/** D-057: el bot es individual: se prende en el chat. */
const botOn = () => prisma.conversation.update({ where: { id: conversationId }, data: { botEnabled: true } });
const customerWrites = (body: string, at = new Date()) =>
  prisma.message.create({ data: { conversationId, direction: "IN", channel: "APP", body, botStatus: "PENDING", createdAt: at } });

function fakeLlm(answer: { reply: string; handoff?: boolean; reason?: string }) {
  const calls: ChatTurn[][] = [];
  const llm: Llm = async (turns) => {
    calls.push(turns);
    return { reply: answer.reply, handoff: answer.handoff ?? false, reason: answer.reason ?? null };
  };
  return { llm, calls };
}

describe("bot del chat de la app (D-056)", () => {
  it("D-056: arranca apagado: si no se prendió en el chat no responde ni llama a la IA", async () => {
    const msg = await customerWrites("Hola");
    const { llm, calls } = fakeLlm({ reply: "Hola!" });
    const r = await processBotReplies(prisma, llm);
    expect(r).toMatchObject({ answered: 0, skipped: 1 });
    expect(calls).toHaveLength(0);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("SKIPPED");
    expect(await prisma.message.count({ where: { fromBot: true } })).toBe(0);
  });

  it("D-057: es individual: prendido en un chat no responde en otro", async () => {
    await botOn();
    const other = await prisma.customer.create({ data: { status: "ACTIVE", firstName: "Otro" } });
    const otherConv = await prisma.conversation.create({ data: { customerId: other.id } });
    await prisma.message.create({ data: { conversationId: otherConv.id, direction: "IN", channel: "APP", body: "¿Qué diferencia hay entre DTF y sublimación?", botStatus: "PENDING" } });
    await customerWrites("¿Qué diferencia hay entre DTF y sublimación?");
    const { llm, calls } = fakeLlm({ reply: "Hola!" });
    expect(await processBotReplies(prisma, llm)).toMatchObject({ answered: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect(await prisma.message.count({ where: { conversationId: otherConv.id, fromBot: true } })).toBe(0);
  });

  it("D-056: prendido responde en el chat con los pedidos reales del cliente y una sola vez", async () => {
    await botOn();
    const msg = await customerWrites("¿Qué diferencia hay entre DTF y sublimación?");
    const { llm, calls } = fakeLlm({ reply: "Sí, tu pedido de DTF está listo para retirar." });
    expect((await processBotReplies(prisma, llm)).answered).toBe(1);
    expect((await processBotReplies(prisma, llm)).answered).toBe(0);

    const system = calls[0]![0]!.content;
    expect(system).toContain("Ana Gómez");
    expect(system).toMatch(/VV-\d+ · DTF · estado: Terminado, listo para retirar/);
    expect(system).toContain("dtf@viavinilo.com");
    expect(calls[0]!.at(-1)).toEqual({ role: "user", content: "¿Qué diferencia hay entre DTF y sublimación?" });

    const reply = await prisma.message.findFirstOrThrow({ where: { fromBot: true } });
    expect(reply).toMatchObject({ direction: "OUT", channel: "APP", body: "Sí, tu pedido de DTF está listo para retirar.", authorId: null });
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("ANSWERED");
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv.customerUnread).toBe(1);
  });

  it("D-056: si deriva a un asesor, marca el chat 'Pide asesor' y el bot se apaga en ese chat", async () => {
    await botOn();
    const msg = await customerWrites("el estampado quedó con un color raro, ¿es normal?");
    const { llm } = fakeLlm({ reply: "Te paso con un asesor.", handoff: true, reason: "Quiere cancelar" });
    expect((await processBotReplies(prisma, llm)).handoffs).toBe(1);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv).toMatchObject({ needsHuman: true, needsHumanReason: "Quiere cancelar", botEnabled: false });
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("HANDOFF");
  });

  it("D-060: memoria por conversación: si ya respondió, no vuelve a saludar; y siempre de vos", async () => {
    await botOn();
    const t = Date.now();
    await prisma.message.create({ data: { conversationId, direction: "IN", channel: "APP", body: "hola", createdAt: new Date(t - 5000) } });
    await prisma.message.create({ data: { conversationId, direction: "OUT", channel: "APP", body: "¡Hola Ana!", fromBot: true, createdAt: new Date(t - 4000) } });
    await customerWrites("¿qué diferencia hay entre DTF y sublimación?", new Date(t - 1000));
    const { llm, calls } = fakeLlm({ reply: "¿Tienes el archivo? Envíalo a látex@viavinilo.com" });
    await processBotReplies(prisma, llm);
    expect(calls[0]![0]!.content).toContain("NO saludes de nuevo");
    expect(calls[0]![0]!.content).toContain("Repetí las medidas EXACTAMENTE");
    const reply = await prisma.message.findFirstOrThrow({ where: { fromBot: true, body: { not: "¡Hola Ana!" } } });
    expect(reply.body).toBe("¿Tenés el archivo? Mandalo a latex@viavinilo.com");
  });

  it("D-060: saludo, trabajo nuevo y '¿está listo?' van por flujos fijos, sin IA", async () => {
    await botOn();
    const { llm, calls } = fakeLlm({ reply: "no debería usarse" });
    for (const text of ["hola", "te paso imprimir dos lonas front 5.10 × 1.10 solvente", "¿ya está listo mi pedido?"]) {
      await customerWrites(text);
      await processBotReplies(prisma, llm);
    }
    expect(calls).toHaveLength(0);
    const replies = (await prisma.message.findMany({ where: { fromBot: true }, orderBy: { createdAt: "asc" } })).map((m) => m.body);
    expect(replies[0]).toBe("¡Hola Ana! Soy el asistente de Via Vinilo. ¿En qué te ayudo?");
    expect(replies[1]).toContain("granformato@viavinilo.com");
    expect(replies[2]).toMatch(/VV-\d+ \(DTF, Remeras logo\): Terminado, listo para retirar/);
  });

  it("D-061: después de un /reset el bot no recuerda nada anterior y vuelve a saludar", async () => {
    await botOn();
    const t = Date.now();
    await prisma.message.create({ data: { conversationId, direction: "IN", channel: "APP", body: "algo viejo", createdAt: new Date(t - 9000) } });
    await prisma.message.create({ data: { conversationId, direction: "OUT", channel: "APP", body: "respuesta vieja", fromBot: true, createdAt: new Date(t - 8000) } });
    await prisma.conversation.update({ where: { id: conversationId }, data: { botResetAt: new Date(t - 5000) } });
    await customerWrites("¿qué diferencia hay entre DTF y sublimación?", new Date(t - 1000));
    const { llm, calls } = fakeLlm({ reply: "Te cuento." });
    await processBotReplies(prisma, llm);
    const turns = calls[0]!;
    expect(turns.map((x) => x.content)).not.toContain("algo viejo");
    expect(turns.map((x) => x.content)).not.toContain("respuesta vieja");
    expect(turns[0]!.content).toContain("Es el primer mensaje: saludá una sola vez");
  });

  it("D-057: cancelar, reclamos, precios, comprobantes o pedir una persona van a un asesor sin pasar por la IA", async () => {
    await botOn();
    await customerWrites("Hola, ¿cuánto sale el metro de DTF?");
    const { llm, calls } = fakeLlm({ reply: "Sale $ 1000", handoff: false });
    // Viernes 20/11 a las 15:00 de Salta: horario de atención.
    expect((await processBotReplies(prisma, llm, { now: () => new Date("2026-11-20T18:00:00Z") })).handoffs).toBe(1);
    expect(calls).toHaveLength(0);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv).toMatchObject({ needsHuman: true, needsHumanReason: "Pide precio o presupuesto", botEnabled: false });
    expect((await prisma.message.findFirstOrThrow({ where: { fromBot: true } })).body).toMatch(/te responde por este mismo chat en un rato/);
  });

  it("D-056: no pisa a una persona: si el equipo respondió después, o el cliente mandó otro mensaje, responde solo el último", async () => {
    await botOn();
    const t = Date.now();
    const first = await customerWrites("Hola", new Date(t - 3000));
    const second = await customerWrites("¿Están abiertos?", new Date(t - 2000));
    const { llm, calls } = fakeLlm({ reply: "Sí, hasta las 17." });
    const r = await processBotReplies(prisma, llm);
    expect(r).toMatchObject({ answered: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: first.id } })).botStatus).toBe("SKIPPED");
    expect((await prisma.message.findUniqueOrThrow({ where: { id: second.id } })).botStatus).toBe("ANSWERED");

    const third = await customerWrites("Gracias", new Date(t - 1000));
    await prisma.message.create({ data: { conversationId, direction: "OUT", channel: "APP", body: "De nada!", createdAt: new Date(t) } });
    expect((await processBotReplies(prisma, llm)).skipped).toBe(1);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: third.id } })).botStatus).toBe("SKIPPED");
  });

  it("D-056: si la IA falla no responde nada y el mensaje queda para el equipo", async () => {
    await botOn();
    const msg = await customerWrites("¿Qué diferencia hay entre DTF y sublimación?");
    const r = await processBotReplies(prisma, async () => {
      throw new Error("timeout");
    });
    expect(r.failed).toBe(1);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("ERROR");
    expect(await prisma.message.count({ where: { fromBot: true } })).toBe(0);
  });
});

describe("controles sobre la IA (D-061)", () => {
  it("D-061: si el cliente no dijo el material, la IA no elige casilla", async () => {
    const llm: Llm = async () => ({ reply: "Mandalo a dtf@viavinilo.com", handoff: false, reason: null });
    const a = await decideAnswer({ text: "Graciela, tel 0387 4322063", firstName: null, alreadyTalking: true, noticesOn: false, jobs: [], turns: [], llm, now: new Date() });
    expect(a.reply).toMatch(/de qué material/);
  });
});

describe("cliente de IA (D-056)", () => {
  it("D-056: lee el JSON del modelo; si no es JSON lo toma como texto sin derivar", () => {
    expect(parseAnswer('{"reply":"Hola","handoff":true,"reason":"reclamo"}')).toEqual({ reply: "Hola", handoff: true, reason: "reclamo" });
    expect(parseAnswer("Hola, ¿en qué te ayudo?")).toEqual({ reply: "Hola, ¿en qué te ayudo?", handoff: false, reason: null });
    expect(() => parseAnswer('{"reply":""}')).toThrow();
  });

  it("D-056: llama a la API compatible con OpenAI con el modelo configurado y nunca muestra la clave en el error", async () => {
    const seen: { url: string; auth: string; body: { model: string } }[] = [];
    const ok = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") ?? "", body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"Hola","handoff":false}' } }] }));
    }) as typeof fetch;
    const llm = openAiLlm({ apiKey: "sk-secreta", baseUrl: "http://ia.test/v1/", model: "modelo-x" }, ok);
    expect(await llm([{ role: "user", content: "hola" }])).toEqual({ reply: "Hola", handoff: false, reason: null });
    expect(seen[0]).toMatchObject({ url: "http://ia.test/v1/chat/completions", auth: "Bearer sk-secreta", body: { model: "modelo-x" } });

    const fail = (async () => new Response("cuota agotada", { status: 429 })) as typeof fetch;
    const err = await openAiLlm({ apiKey: "sk-secreta", baseUrl: "http://ia.test/v1", model: "m" }, fail)([]).catch((e: Error) => e);
    expect(String(err)).toContain("429");
    expect(String(err)).not.toContain("sk-secreta");
  });
});
