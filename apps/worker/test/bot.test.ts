import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ollamaLlm, openAiLlm, parseAnswer, type ChatTurn, type Llm } from "../src/bot/llm";
import type { ToolKit } from "../src/bot/tools";
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

/**
 * IA de mentira. Con `tools`, antes de contestar usa esas herramientas como lo haría el modelo (D-097),
 * y guarda lo que le devolvieron.
 */
function fakeLlm(answer: { reply: string; handoff?: boolean; reason?: string; tools?: [string, Record<string, unknown>][] }) {
  const calls: ChatTurn[][] = [];
  const kits: ToolKit[] = [];
  const results: string[] = [];
  const llm: Llm = async (turns, kit) => {
    calls.push(turns);
    if (kit) kits.push(kit);
    for (const [name, args] of answer.tools ?? []) results.push(kit!.run(name, args));
    if (kit?.handoff) return { reply: answer.reply, handoff: true, reason: kit.handoff.reason };
    return { reply: answer.reply, handoff: answer.handoff ?? false, reason: answer.reason ?? null };
  };
  return { llm, calls, kits, results };
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
    await prisma.message.create({ data: { conversationId: otherConv.id, direction: "IN", channel: "APP", body: "Soy nueva, les cuento que trabajo con remeras estampadas", botStatus: "PENDING" } });
    await customerWrites("Soy nueva, les cuento que trabajo con remeras estampadas");
    const { llm, calls } = fakeLlm({ reply: "Hola!" });
    expect(await processBotReplies(prisma, llm)).toMatchObject({ answered: 1, skipped: 1 });
    expect(calls).toHaveLength(1);
    expect(await prisma.message.count({ where: { conversationId: otherConv.id, fromBot: true } })).toBe(0);
  });

  it("D-056: prendido responde en el chat con los pedidos reales del cliente y una sola vez", async () => {
    await botOn();
    const msg = await customerWrites("Soy nueva, les cuento que trabajo con remeras estampadas");
    const { llm, calls, kits, results } = fakeLlm({ reply: "Sí, tu pedido de DTF está listo para retirar.", tools: [["ver_mis_pedidos", {}]] });
    expect((await processBotReplies(prisma, llm)).answered).toBe(1);
    expect((await processBotReplies(prisma, llm)).answered).toBe(0);

    // D-097: el prompt es corto y los pedidos reales los pide con una herramienta.
    const system = calls[0]![0]!.content;
    expect(system).toContain("Ana Gómez");
    expect(system).toContain("ver_mis_pedidos");
    expect(kits[0]!.definitions.map((d) => d.name)).toEqual(["ver_mis_pedidos", "info_servicio", "sucursales_y_horarios", "datos_de_pago", "preguntas_frecuentes", "derivar_a_asesor"]);
    expect(results[0]).toMatch(/"estado":"Terminado, listo para retirar"/);
    expect(calls[0]!.at(-1)).toEqual({ role: "user", content: "Soy nueva, les cuento que trabajo con remeras estampadas" });

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
    await customerWrites("soy nueva, les cuento que trabajo con remeras estampadas", new Date(t - 1000));
    const { llm, calls } = fakeLlm({ reply: "¿Tienes el archivo? Envíalo a látex@viavinilo.com" });
    await processBotReplies(prisma, llm);
    expect(calls[0]![0]!.content).toContain("no saludes de nuevo");
    expect(calls[0]![0]!.content).toContain("Repetí las medidas exactamente");
    const reply = await prisma.message.findFirstOrThrow({ where: { fromBot: true, body: { not: "¡Hola Ana!" } } });
    expect(reply.body).toBe("¿Tenés el archivo? Mandalo a latex@viavinilo.com");
  });

  it("D-097: la IA responde todo; si contesta sobre un pedido sin haberlo consultado, va la respuesta armada con los datos", async () => {
    await botOn();
    const { llm, calls } = fakeLlm({ reply: "¡Hola Ana! Sí, ya está, pasá cuando quieras." });
    const t0 = Date.now();
    await customerWrites("hola", new Date(t0));
    await processBotReplies(prisma, llm);
    await customerWrites("¿ya está listo mi pedido?", new Date(t0 + 1000));
    await processBotReplies(prisma, llm);
    expect(calls).toHaveLength(2);
    const replies = (await prisma.message.findMany({ where: { fromBot: true }, orderBy: { createdAt: "asc" } })).map((m) => m.body);
    // El saludo lo escribe la IA.
    expect(replies[0]).toBe("¡Hola Ana! Sí, ya está, pasá cuando quieras.");
    // Sobre el pedido no miró los pedidos: no se le cree y va el estado real.
    expect(replies[1]).toMatch(/VV-\d+ \(DTF, Remeras logo\): está listo para retirar en Sucursal Centro/);
  });

  it("D-097: si la IA consulta los pedidos, su respuesta se usa tal cual; si usa derivar_a_asesor, deriva", async () => {
    await botOn();
    const t0 = Date.now();
    const conPedidos = fakeLlm({ reply: "Tu pedido de remeras ya está listo, podés pasar a buscarlo.", tools: [["ver_mis_pedidos", {}]] });
    await customerWrites("¿ya está listo mi pedido?", new Date(t0));
    expect(await processBotReplies(prisma, conPedidos.llm)).toMatchObject({ answered: 1 });
    const last = await prisma.message.findFirstOrThrow({ where: { fromBot: true }, orderBy: { createdAt: "desc" } });
    expect(last.body).toBe("Tu pedido de remeras ya está listo, podés pasar a buscarlo.");

    const deriva = fakeLlm({ reply: "Te paso con un asesor del equipo.", tools: [["derivar_a_asesor", { motivo: "Quiere que le guarden el pedido una semana" }]] });
    await customerWrites("¿me lo pueden guardar una semana más?", new Date(t0 + 1000));
    expect(await processBotReplies(prisma, deriva.llm)).toMatchObject({ handoffs: 1 });
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv).toMatchObject({ needsHuman: true, botEnabled: false, needsHumanReason: "Quiere que le guarden el pedido una semana" });
  });

  it("D-097: si la IA falla, contesta la respuesta armada si la hay; si no, queda para el equipo", async () => {
    await botOn();
    const broken: Llm = async () => {
      throw new Error("Ollama no responde");
    };
    const t0 = Date.now();
    await customerWrites("¿ya está listo mi pedido?", new Date(t0));
    expect(await processBotReplies(prisma, broken)).toMatchObject({ answered: 1, failed: 0 });
    const last = await prisma.message.findFirstOrThrow({ where: { fromBot: true }, orderBy: { createdAt: "desc" } });
    expect(last.body).toMatch(/está listo para retirar en/);
  });

  it("D-061: después de un /reset el bot no recuerda nada anterior y vuelve a saludar", async () => {
    await botOn();
    const t = Date.now();
    await prisma.message.create({ data: { conversationId, direction: "IN", channel: "APP", body: "algo viejo", createdAt: new Date(t - 9000) } });
    await prisma.message.create({ data: { conversationId, direction: "OUT", channel: "APP", body: "respuesta vieja", fromBot: true, createdAt: new Date(t - 8000) } });
    await prisma.conversation.update({ where: { id: conversationId }, data: { botResetAt: new Date(t - 5000) } });
    await customerWrites("soy nueva, les cuento que trabajo con remeras estampadas", new Date(t - 1000));
    const { llm, calls } = fakeLlm({ reply: "Te cuento." });
    await processBotReplies(prisma, llm);
    const turns = calls[0]!;
    expect(turns.map((x) => x.content)).not.toContain("algo viejo");
    expect(turns.map((x) => x.content)).not.toContain("respuesta vieja");
    expect(turns[0]!.content).toContain("Es el primer mensaje: saludá una vez");
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
    const msg = await customerWrites("Soy nueva, les cuento que trabajo con remeras estampadas");
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

describe("el bot informa el estado real del archivo (D-092)", () => {
  it("D-092 y D-097: con un pedido en 'Archivo con error', '¿tenés mi archivo?' y '¿está correcto?' explican el problema aunque la IA invente", async () => {
    const reason = await prisma.fileErrorReason.create({ data: { code: "LOW_RESOLUTION", label: "Resolución baja" } });
    const job = await prisma.jobOrder.create({
      data: {
        customerId,
        sectorId,
        status: "FILE_ERROR",
        source: "API",
        description: "58 x 100 cm · 1 copia",
        events: { create: { fromStatus: "RECEIVED", toStatus: "FILE_ERROR", reasonId: reason.id, note: "Control automático: El archivo tiene 600 × 1000 píxeles. Para 58 × 100 cm da 25 dpi; el mínimo para DTF es 250. Va a salir pixelado." } },
      },
    });
    await botOn();
    const { llm, calls } = fakeLlm({ reply: "¡Dale! Apenas llegue tu archivo, lo veré en el sistema. ¿Podés esperar unos minutos mientras lo reviso?" });
    const t0 = Date.now();
    await customerWrites("tenes mi archivo?", new Date(t0));
    expect(await processBotReplies(prisma, llm)).toMatchObject({ answered: 1 });
    await customerWrites("esta correcto?", new Date(t0 + 1000));
    expect(await processBotReplies(prisma, llm)).toMatchObject({ answered: 1 });
    const replies = await prisma.message.findMany({ where: { conversationId, fromBot: true }, orderBy: { createdAt: "asc" } });
    expect(replies).toHaveLength(2);
    for (const r of replies) {
      expect(r.body).toContain("el archivo tiene un problema: Resolución baja");
      expect(r.body).toContain("da 25 dpi");
      expect(r.body).toContain("Mandalo corregido con el clip");
      expect(r.body).not.toMatch(/apenas llegue/i);
    }
    // El cliente tiene otros pedidos: la primera va con la lista y "¿por cuál?" sin IA (D-101). En la
    // segunda la IA respondió sin mirar los pedidos: se descartó su respuesta inventada.
    expect(calls).toHaveLength(1);
    await prisma.jobEvent.deleteMany({ where: { jobId: job.id } });
    await prisma.jobOrder.delete({ where: { id: job.id } });
  });

  it("D-092: si la IA va a repetir exactamente lo que ya dijo, el bot deriva a un asesor en vez de repetirlo", async () => {
    await botOn();
    const { llm } = fakeLlm({ reply: "No tengo ese dato, ¿me contás un poco más?" });
    const t0 = Date.now();
    await customerWrites("soy nueva, les cuento que trabajo con remeras estampadas", new Date(t0));
    expect(await processBotReplies(prisma, llm)).toMatchObject({ answered: 1, handoffs: 0 });
    await customerWrites("y también hago buzos para egresados", new Date(t0 + 1000));
    expect(await processBotReplies(prisma, llm)).toMatchObject({ handoffs: 1 });
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv).toMatchObject({ needsHuman: true, botEnabled: false, needsHumanReason: "El bot iba a repetir la misma respuesta" });
    const last = await prisma.message.findFirstOrThrow({ where: { conversationId, fromBot: true }, orderBy: { createdAt: "desc" } });
    expect(last.body).toMatch(/Te paso con un asesor/);
  });
});

describe("IA local con herramientas (D-097)", () => {
  it("D-097: con Ollama usa la API nativa, con herramientas y contexto de 8.192 tokens; le pasa el resultado y contesta", async () => {
    const bodies: Record<string, unknown>[] = [];
    const replies = [
      { message: { content: "", tool_calls: [{ function: { name: "ver_mis_pedidos", arguments: { numero: 7 } } }] } },
      { message: { content: "<think>miro</think>Tu pedido VV-000007 está listo." } },
    ];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      expect(url).toBe("http://ollama:11434/api/chat");
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      return new Response(JSON.stringify(replies[bodies.length - 1]), { status: 200 });
    }) as unknown as typeof fetch;
    const llm = ollamaLlm({ baseUrl: "http://ollama:11434/v1", apiKey: "ollama", model: "qwen3:8b" }, fetchImpl);
    const used: string[] = [];
    const kit: ToolKit = {
      definitions: [{ name: "ver_mis_pedidos", description: "x", parameters: { type: "object", properties: {} } }],
      used,
      handoff: null,
      run: (name, args) => {
        used.push(name);
        return JSON.stringify({ visto: args });
      },
    };
    const a = await llm([{ role: "system", content: "s" }, { role: "user", content: "¿está el 7?" }], kit);
    expect(a).toEqual({ reply: "Tu pedido VV-000007 está listo.", handoff: false, reason: null });
    expect(used).toEqual(["ver_mis_pedidos"]);
    expect(bodies[0]).toMatchObject({ model: "qwen3:8b", think: false, options: { num_ctx: 8192 } });
    expect((bodies[0]!.tools as unknown[]).length).toBe(1);
    const second = bodies[1]!.messages as { role: string; content: string }[];
    expect(second.at(-1)).toMatchObject({ role: "tool", content: '{"visto":{"numero":7}}' });
  });
});

describe("ajustes de la IA con herramientas (D-098)", () => {
  const base = { firstName: "Ana", alreadyTalking: true, noticesOn: false, jobs: [], turns: [], now: new Date("2026-11-25T14:30:00-03:00") };
  it("D-098: una pregunta que la IA contesta sin ninguna herramienta no se le cree: si no hay respuesta armada, deriva", async () => {
    const { llm } = fakeLlm({ reply: "El DTF es una sublimación de tintes." });
    const a = await decideAnswer({ ...base, text: "¿qué diferencia hay entre DTF y sublimación?", llm });
    expect(a).toMatchObject({ handoff: true, source: "handoff" });
  });
  it("D-098: si la pregunta tiene su herramienta y no la usó, va la respuesta armada (horarios, formato)", async () => {
    const { llm } = fakeLlm({ reply: "La de San Juan abre hasta las 13:00." });
    const a = await decideAnswer({ ...base, text: "hasta qué hora abren hoy la de san juan?", llm });
    expect(a.source).toBe("flow");
    expect(a.reply).toContain("08:30 a 19:30");
    const f = await decideAnswer({ ...base, text: "quiero imprimir 20 remeras, cómo te mando el archivo?", llm: fakeLlm({ reply: "PNG o JPEG." }).llm });
    expect(f.reply).toContain("PNG con fondo transparente");
  });
  it("D-098: si escribe la llamada a derivar en el texto, deriva igual y no se la muestra al cliente", async () => {
    const { llm } = fakeLlm({ reply: 'No, no podemos guardarlo. Contactá a un asesor._derivar_a_asesor{"motivo":"Extender plazo"}', tools: [["ver_mis_pedidos", {}]] });
    const a = await decideAnswer({ ...base, text: "¿me pueden guardar el pedido una semana más?", llm });
    expect(a).toMatchObject({ handoff: true, reason: "Extender plazo" });
    expect(a.reply).not.toContain("derivar_a_asesor");
  });
  it("D-098: saca asteriscos y la herramienta de horarios dice cómo está hoy", async () => {
    const { llm } = fakeLlm({ reply: "El alias es **VIAPRINT.MACRO**.", tools: [["datos_de_pago", { servicio: "lona" }]] });
    const a = await decideAnswer({ ...base, text: "pasame el alias para la seña de la lona", llm });
    expect(a.reply).toBe("El alias es VIAPRINT.MACRO.");
    const h = fakeLlm({ reply: "ok", tools: [["sucursales_y_horarios", {}]] });
    await decideAnswer({ ...base, text: "dónde quedan?", llm: h.llm });
    expect(h.results[0]).toContain("miércoles");
    expect(h.results[0]).toContain("ahora está abierta, hoy cierra a las 19:30");
    expect(h.results[0]).toContain("ahora está abierta, hoy cierra a las 17:00");
  });

  it("D-099: si el cliente saluda y pregunta, la respuesta armada también saluda; ver_mis_pedidos dice dónde se retira", async () => {
    const jobs = [{ label: "VV-000564", sector: "DTF Textil", status: "Terminado, listo para retirar", description: null, quotedAmount: null, depositRequired: false, depositPaid: false, estimatedReadyAt: null, createdAt: new Date(), pickupBranch: "san-juan" }];
    const { llm, results } = fakeLlm({ reply: "Sí, ya está.", tools: [["ver_mis_pedidos", {}]] });
    await decideAnswer({ ...base, alreadyTalking: false, jobs, text: "Hola que tal mi pedido ya esta para retirar", llm });
    expect(results[0]).toContain('"retira_en":"Sucursal Centro, San Juan 714, Salta"');
    const sinMirar = await decideAnswer({ ...base, alreadyTalking: false, jobs, text: "Hola que tal mi pedido ya esta para retirar", llm: fakeLlm({ reply: "Sí." }).llm });
    expect(sinMirar.reply).toMatch(/^¡Hola Ana! Tu pedido: VV-000564 \(DTF Textil\): está listo para retirar en Sucursal Centro/);
  });

  it("D-101: 'gracias' cierra con la respuesta fija; la respuesta arranca en mayúscula; numero 0 es 'sin número'", async () => {
    const t = await decideAnswer({ ...base, text: "gracias!!", llm: fakeLlm({ reply: "de nada! ¿Cómo puedo ayudarte?" }).llm });
    expect(t).toMatchObject({ source: "flow", reply: "¡De nada! Cualquier cosa, escribime por acá." });
    const h = await decideAnswer({ ...base, alreadyTalking: false, text: "hola", llm: fakeLlm({ reply: "hola Ana, ¿en qué te ayudo?" }).llm });
    expect(h.reply).toBe("¡Hola Ana! ¿En qué te ayudo?");
    const jobs = [{ label: "VV-000103", sector: "DTF Textil", status: "Archivo recibido", description: null, quotedAmount: null, depositRequired: false, depositPaid: false, estimatedReadyAt: null, createdAt: new Date(), files: [], hasLinks: true }];
    const z = fakeLlm({ reply: "ok", tools: [["ver_mis_pedidos", { numero: 0 }]] });
    await decideAnswer({ ...base, jobs, text: "llegó lo que les mandé por link?", llm: z.llm });
    expect(z.results[0]).not.toContain("No hay un pedido");
    expect(z.results[0]).toContain("VV-000103");
  });

  it("D-101: con varios pedidos y sin decir cuál, va la lista con '¿por cuál?'; el pedido sin listo no da sucursal", async () => {
    const job = (n: string, status: string) => ({ label: n, sector: "DTF Textil", status, description: null, quotedAmount: null, depositRequired: false, depositPaid: false, estimatedReadyAt: null, createdAt: new Date(), files: ["a.png"] });
    const jobs = [job("VV-000111", "Archivo recibido"), job("VV-000112", "Impreso")];
    const r = await decideAnswer({ ...base, jobs, text: "tenes mi archivo?", llm: fakeLlm({ reply: "No, todavía no está listo." }).llm });
    expect(r.source).toBe("flow");
    expect(r.reply).toContain("¿Por cuál me consultás?");
    const k = fakeLlm({ reply: "ok", tools: [["ver_mis_pedidos", {}]] });
    await decideAnswer({ ...base, jobs: [job("VV-000108", "Impreso")], text: "y ahora en qué está?", llm: k.llm });
    expect(k.results[0]).toContain('"listo_para_retirar":false');
    expect(k.results[0]).not.toContain('"retira_en"');
    const g = await decideAnswer({ ...base, alreadyTalking: false, text: "buen día! tengo una consulta", llm: fakeLlm({ reply: "Buen día, Ana! ¿en qué te ayudo?" }).llm });
    expect(g.reply).toBe("¡Buen día, Ana! ¿En qué te ayudo?");
  });

  it("D-103: si el único pedido ya se entregó, lo dice (sin IA); sin ningún pedido, no promete nada", async () => {
    const delivered = { label: "VV-000110", sector: "DTF Textil", status: "Entregado", description: null, quotedAmount: null, depositRequired: false, depositPaid: false, estimatedReadyAt: null, createdAt: new Date(), files: ["x.png"] };
    const ai = fakeLlm({ reply: "No, todavía no está lo tuyo. ¿Podés mandarme el archivo?" });
    const r = await decideAnswer({ ...base, jobs: [delivered], text: "ya está lo mío?", llm: ai.llm });
    expect(r.source).toBe("flow");
    expect(r.reply).toBe("No tenés pedidos en curso: el último, VV-000110 (DTF Textil), ya lo entregamos. Si querés hacer otro, mandá el archivo con el clip 📎 de este chat y te pasamos el precio.");
    expect(ai.calls).toHaveLength(0);
    const none = await decideAnswer({ ...base, jobs: [], text: "ya está listo mi pedido?", llm: fakeLlm({ reply: "Sí, ya está listo." }).llm });
    expect(none.reply).toMatch(/^Todavía no veo pedidos tuyos en curso/);
    const k = fakeLlm({ reply: "ok", tools: [["ver_mis_pedidos", {}]] });
    await decideAnswer({ ...base, jobs: [delivered], text: "che, y lo que pedí?", llm: k.llm });
    expect(k.results[0]).toContain("El último, VV-000110 (DTF Textil), ya se entregó.");
  });
});
