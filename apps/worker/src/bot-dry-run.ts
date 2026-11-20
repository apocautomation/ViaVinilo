import { readFileSync } from "node:fs";
import { openAiLlm } from "./bot/llm";
import { buildSystemPrompt } from "./bot/prompt";
import { decideAnswer } from "./bot/reply";
import { botConfig } from "./config";

/**
 * Prueba de punta a punta del bot, sin tocar la base (D-061): pasa cada mensaje por la misma
 * decisión que usa el worker (derivación fija → flujos fijos → IA con controles) y muestra la
 * respuesta y de dónde salió.
 * Uso en el servidor: docker compose exec worker node dist/bot-dry-run.js /ruta/mensajes.json
 * El JSON es una lista de { "text": "...", "firstName": "..." }. No se guarda en el repo: son
 * mensajes reales de clientes.
 */
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Falta el archivo con los mensajes");
  const config = botConfig(process.env);
  if (!config) throw new Error("No hay IA configurada (BOT_API_URL u OPENAI_API_KEY)");
  const llm = openAiLlm(config);
  const cases = JSON.parse(readFileSync(file, "utf8")) as { text: string; firstName?: string }[];
  for (const [i, c] of cases.entries()) {
    const firstName = c.firstName ?? null;
    const now = new Date();
    const system = buildSystemPrompt({ customerName: firstName ?? "Cliente", customerNumber: 0, pendingSignup: false, jobs: [], now, alreadyTalking: false, noticesOn: false });
    const t0 = Date.now();
    const a = await decideAnswer({
      text: c.text,
      firstName,
      alreadyTalking: false,
      noticesOn: false,
      jobs: [],
      turns: [
        { role: "system", content: system },
        { role: "user", content: c.text },
      ],
      llm,
      now,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n#${i + 1} CLIENTE: ${c.text.replace(/\s+/g, " ").slice(0, 300)}`);
    console.log(`   BOT [${a.source}${a.handoff ? `, deriva: ${a.reason}` : ""}, ${secs} s]: ${a.reply}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
