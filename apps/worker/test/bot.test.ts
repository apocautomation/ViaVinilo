import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { openAiLlm, parseAnswer, type ChatTurn, type Llm } from "../src/bot/llm";
import { BOT_SETTING_KEY, processBotReplies } from "../src/bot/reply";
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
  await prisma.appSetting.deleteMany();
  const conv = await prisma.conversation.create({ data: { customerId, botEnabled: true } });
  conversationId = conv.id;
});

afterAll(async () => {
  await prisma?.$disconnect();
  await stopDb?.();
});

const botOn = () => prisma.appSetting.create({ data: { key: BOT_SETTING_KEY, value: { enabled: true } } });
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
  it("D-056: arranca apagado: sin el interruptor general no responde ni llama a la IA", async () => {
    const msg = await customerWrites("Hola");
    const { llm, calls } = fakeLlm({ reply: "Hola!" });
    const r = await processBotReplies(prisma, llm);
    expect(r).toMatchObject({ answered: 0, skipped: 1 });
    expect(calls).toHaveLength(0);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("SKIPPED");
    expect(await prisma.message.count({ where: { fromBot: true } })).toBe(0);
  });

  it("D-056: apagado en ese chat no responde aunque el general esté prendido", async () => {
    await botOn();
    await prisma.conversation.update({ where: { id: conversationId }, data: { botEnabled: false } });
    await customerWrites("Hola");
    const { llm, calls } = fakeLlm({ reply: "Hola!" });
    expect((await processBotReplies(prisma, llm)).skipped).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it("D-056: prendido responde en el chat con los pedidos reales del cliente y una sola vez", async () => {
    await botOn();
    const msg = await customerWrites("¿Está listo mi pedido?");
    const { llm, calls } = fakeLlm({ reply: "Sí, tu pedido de DTF está listo para retirar." });
    expect((await processBotReplies(prisma, llm)).answered).toBe(1);
    expect((await processBotReplies(prisma, llm)).answered).toBe(0);

    const system = calls[0]![0]!.content;
    expect(system).toContain("Ana Gómez");
    expect(system).toMatch(/VV-\d+ · DTF · estado: Terminado, listo para retirar/);
    expect(system).toContain("dtf@viavinilo.com");
    expect(calls[0]!.at(-1)).toEqual({ role: "user", content: "¿Está listo mi pedido?" });

    const reply = await prisma.message.findFirstOrThrow({ where: { fromBot: true } });
    expect(reply).toMatchObject({ direction: "OUT", channel: "APP", body: "Sí, tu pedido de DTF está listo para retirar.", authorId: null });
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("ANSWERED");
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv.customerUnread).toBe(1);
  });

  it("D-056: si deriva a un asesor, marca el chat 'Pide asesor' y el bot se apaga en ese chat", async () => {
    await botOn();
    const msg = await customerWrites("Quiero cancelar el pedido");
    const { llm } = fakeLlm({ reply: "Te paso con un asesor.", handoff: true, reason: "Quiere cancelar" });
    expect((await processBotReplies(prisma, llm)).handoffs).toBe(1);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv).toMatchObject({ needsHuman: true, needsHumanReason: "Quiere cancelar", botEnabled: false });
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("HANDOFF");
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
    const msg = await customerWrites("Hola");
    const r = await processBotReplies(prisma, async () => {
      throw new Error("timeout");
    });
    expect(r.failed).toBe(1);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).botStatus).toBe("ERROR");
    expect(await prisma.message.count({ where: { fromBot: true } })).toBe(0);
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
