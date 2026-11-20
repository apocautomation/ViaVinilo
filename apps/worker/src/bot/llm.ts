/**
 * Cliente de chat compatible con la API de OpenAI (D-056). Con BOT_API_URL se puede apuntar a otro
 * proveedor compatible, por ejemplo un modelo local con Ollama (el contrato pide IA local con OpenAI
 * de respaldo; hoy el VPS no alcanza para el modelo local, I-20).
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

export type Llm = (messages: ChatTurn[]) => Promise<BotAnswer>;

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
  return async (messages) => {
    const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      // Nunca se loguea la clave; solo el código y el mensaje del proveedor.
      const detail = await res.text().catch(() => "");
      throw new LlmError(`El proveedor de IA respondió ${res.status}: ${detail.slice(0, 200)}`, res.status);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseAnswer(data.choices?.[0]?.message?.content ?? "");
  };
}
