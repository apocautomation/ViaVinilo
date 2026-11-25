import { readFileSync } from "node:fs";
import { makeLlm } from "./bot/llm";
import { dryRunJobs, type DryRunJob } from "./bot/dry-run-jobs";
import { buildAgentPrompt } from "./bot/prompt";
import { decideAnswer } from "./bot/reply";
import { botConfig } from "./config";

/**
 * Prueba de punta a punta del bot, sin tocar la base (D-061): pasa cada mensaje por la misma
 * decisión que usa el worker (derivación fija → flujos fijos → IA con controles) y muestra la
 * respuesta y de dónde salió.
 * Uso en el servidor: docker compose exec worker node dist/bot-dry-run.js /ruta/mensajes.json
 * El JSON es una lista de { "text": "...", "firstName": "...", "jobs": [...], "alreadyTalking": true,
 * "noticesOn": true }. Con "jobs" (D-092, D-096) se prueba con pedidos cargados: cada pedido acepta los
 * mismos datos que recibe el bot en el worker (status, files, hasLinks, fileIssue, fileCheck,
 * quotedAmount, depositRequired, depositAmount, depositPaid…). No se guarda en el repo: son mensajes
 * reales de clientes.
 */
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Falta el archivo con los mensajes");
  const config = botConfig(process.env);
  if (!config) throw new Error("No hay IA configurada (BOT_API_URL u OPENAI_API_KEY)");
  const llm = makeLlm(config);
  console.log(`Modelo: ${config.model}`);
  const cases = JSON.parse(readFileSync(file, "utf8")) as {
    text: string;
    firstName?: string;
    jobs?: DryRunJob[];
    alreadyTalking?: boolean;
    noticesOn?: boolean;
    /** Mensajes anteriores del mismo chat (D-101), para probar el contexto: "el 51", "lona". */
    history?: { role: "user" | "assistant"; content: string }[];
    pendingSignup?: boolean;
    /** Qué se espera, para leer el resultado (no se evalúa solo). */
    expect?: string;
  }[];
  for (const [i, c] of cases.entries()) {
    const firstName = c.firstName ?? null;
    const now = new Date();
    const jobs = dryRunJobs(c.jobs, now);
    const history = c.history ?? [];
    const alreadyTalking = c.alreadyTalking ?? history.some((h) => h.role === "assistant");
    const noticesOn = c.noticesOn ?? false;
    const system = buildAgentPrompt({ customerName: firstName ?? "Cliente", customerNumber: 0, pendingSignup: c.pendingSignup ?? false, jobs, now, alreadyTalking, noticesOn });
    const t0 = Date.now();
    const a = await decideAnswer({
      text: c.text,
      firstName,
      alreadyTalking,
      noticesOn,
      jobs,
      turns: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: c.text },
      ],
      llm,
      now,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n#${i + 1} CLIENTE: ${c.text.replace(/\s+/g, " ").slice(0, 300)}${history.length ? `  (con ${history.length} mensajes antes)` : ""}`);
    if (c.expect) console.log(`   ESPERADO: ${c.expect}`);
    const tools = a.tools?.length ? `, herramientas: ${a.tools.join(" + ")}` : "";
    console.log(`   BOT [${a.source}${tools}${a.handoff ? `, deriva: ${a.reason}` : ""}, ${secs} s]: ${a.reply}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
