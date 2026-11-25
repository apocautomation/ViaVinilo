import type { ToolKit } from "./tools";

/**
 * Clientes de IA del bot (D-056, D-097). En producción corre un modelo local con Ollama, por su API
 * nativa (permite fijar el contexto y usar herramientas, como el agente de Trip). Con OPENAI_API_KEY y
 * sin BOT_API_URL se usa la API de OpenAI.
 */

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BotAnswer {
  reply: string;
  handoff: boolean;
  reason: string | null;
}

/**
 * Con `kit`, la IA puede pedir datos con herramientas (D-097): la respuesta es texto libre y deriva si
 * usó `derivar_a_asesor`. Sin `kit`, contesta el JSON {reply, handoff, reason} de siempre.
 */
export type Llm = (messages: ChatTurn[], kit?: ToolKit) => Promise<BotAnswer>;

/** Rondas máximas de herramientas por respuesta: después, la IA tiene que contestar con lo que tiene. */
const MAX_TOOL_ROUNDS = 4;

/** Los modelos que "piensan" (qwen3) a veces dejan el razonamiento en el texto: se saca. */
const withoutThinking = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

/** Respuesta final cuando se usaron herramientas. */
function toolAnswer(text: string, kit: ToolKit): BotAnswer {
  const reply = withoutThinking(text);
  if (!reply) throw new LlmError("El modelo respondió vacío");
  return { reply, handoff: kit.handoff !== null, reason: kit.handoff?.reason ?? null };
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

const toolSpecs = (kit: ToolKit) => kit.definitions.map((d) => ({ type: "function", function: d }));

/** Ollama por su API nativa (D-097): contexto de 8.192 tokens, herramientas y modelo cargado 30 min. */
export function ollamaLlm(config: LlmConfig, fetchImpl: typeof fetch = fetch): Llm {
  const base = config.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  return async (messages, kit) => {
    type Msg = { role: string; content: string; tool_calls?: unknown[]; tool_name?: string };
    const history: Msg[] = [...messages];
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const last = round === MAX_TOOL_ROUNDS;
      const res = await fetchImpl(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: history,
          stream: false,
          // D-098: cargado todo el día; recargarlo tarda ~90 s en este servidor.
          keep_alive: "24h",
          // Sin herramientas en la última ronda: tiene que contestar.
          ...(kit && !last ? { tools: toolSpecs(kit) } : {}),
          ...(kit ? {} : { format: "json" }),
          ...(/^qwen3/i.test(config.model) ? { think: false } : {}),
          options: { temperature: 0.3, num_ctx: 8192 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new LlmError(`Ollama respondió ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }
      const data = (await res.json()) as { message?: { content?: string; tool_calls?: { function: { name: string; arguments: unknown } }[] } };
      const msg = data.message ?? {};
      const calls = kit && !last ? (msg.tool_calls ?? []) : [];
      if (!calls.length) return kit ? toolAnswer(msg.content ?? "", kit) : parseAnswer(withoutThinking(msg.content ?? ""));
      history.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
      for (const c of calls) history.push({ role: "tool", tool_name: c.function.name, content: kit!.run(c.function.name, parseArgs(c.function.arguments)) });
    }
    throw new LlmError("El modelo no terminó de usar las herramientas");
  };
}

/** Elige el cliente: Ollama nativo si es el modelo local, la API de OpenAI si hay clave de OpenAI. */
export function makeLlm(config: LlmConfig, fetchImpl: typeof fetch = fetch): Llm {
  return config.apiKey === "ollama" ? ollamaLlm(config, fetchImpl) : openAiLlm(config, fetchImpl);
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Interpreta la respuesta del modelo. Si no es el JSON pedido, la trata como texto y no deriva. */
export function parseAnswer(raw: string): BotAnswer {
  const text = raw.trim();
  try {
    const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Partial<{ reply: unknown; handoff: unknown; reason: unknown }>;
    const reply = typeof json.reply === "string" ? json.reply.trim() : "";
    if (!reply) throw new LlmError("El modelo respondió sin texto");
    return { reply, handoff: json.handoff === true, reason: typeof json.reason === "string" && json.reason.trim() ? json.reason.trim() : null };
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (!text) throw new LlmError("El modelo respondió vacío");
    return { reply: text, handoff: false, reason: null };
  }
}

export function openAiLlm(config: LlmConfig, fetchImpl: typeof fetch = fetch): Llm {
  return async (messages, kit) => {
    type Msg = { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };
    const history: Msg[] = [...messages];
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const last = round === MAX_TOOL_ROUNDS;
      const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: history,
          temperature: 0.3,
          max_tokens: 500,
          ...(kit ? (last ? {} : { tools: toolSpecs(kit) }) : { response_format: { type: "json_object" } }),
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        // Nunca se loguea la clave; solo el código y el mensaje del proveedor.
        const detail = await res.text().catch(() => "");
        throw new LlmError(`El proveedor de IA respondió ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
      const msg = data.choices?.[0]?.message ?? {};
      const calls = kit && !last ? (msg.tool_calls ?? []) : [];
      if (!calls.length) return kit ? toolAnswer(msg.content ?? "", kit) : parseAnswer(msg.content ?? "");
      history.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
      for (const c of calls) history.push({ role: "tool", tool_call_id: c.id, content: kit!.run(c.function.name, parseArgs(c.function.arguments)) });
    }
    throw new LlmError("El modelo no terminó de usar las herramientas");
  };
}
