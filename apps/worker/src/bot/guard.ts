import { help } from "@viavinilo/contracts";

/**
 * Controles fijos sobre lo que escribe el modelo antes de mandarlo (D-060):
 * - las casillas de Via Vinilo se escriben bien (sin tildes ni inventadas: "látex@" → "latex@");
 * - si los avisos automáticos están apagados, no promete "te avisamos".
 */
const KNOWN = new Set(help.SERVICES.map((s) => s.email));

const strip = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function fixMailboxes(text: string): string {
  return text.replace(/[\p{L}\d._+-]+@viavinilo\.com/giu, (m) => {
    const plain = strip(m).toLowerCase();
    return KNOWN.has(plain) ? plain : m;
  });
}

/** Corta en oraciones: el punto de un mail o de un link ("dtf@viavinilo.com") no es fin de oración. */
const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

/** Saca las oraciones que cumplen el patrón. Devuelve "" si no queda nada. */
export function dropSentencesWith(text: string, re: RegExp): string {
  return sentencesOf(text)
    .filter((s) => !re.test(s))
    .join(" ")
    .trim();
}

export function dropNoticePromises(text: string): string {
  const out = dropSentencesWith(text, /\bte (avisamos|avisaremos|vamos a avisar|notificamos)\b/i);
  return out || text;
}

const TOOL_NAMES = "ver_mis_pedidos|info_servicio|sucursales_y_horarios|datos_de_pago|preguntas_frecuentes|derivar_a_asesor";

/**
 * El modelo a veces escribe la llamada a la herramienta en el texto en vez de usarla (D-098):
 * "…coordinar._derivar_a_asesor{"motivo":"…"}". Se saca del texto; si era derivar, se deriva igual.
 */
export function stripToolText(text: string): { text: string; handoff: string | null } {
  let handoff: string | null = null;
  const call = new RegExp(`<tool_call>[\\s\\S]*?</tool_call>|(?<![a-z])_?(${TOOL_NAMES})\\s*(\\{[^}]*\\}|\\([^)]*\\))?`, "g");
  const out = text.replace(call, (m, name: string | undefined) => {
    if ((name ?? m).includes("derivar_a_asesor")) {
      const motivo = /"motivo"\s*:\s*"([^"]*)"/.exec(m)?.[1];
      handoff = motivo?.trim() || "El bot derivó a un asesor";
    }
    return "";
  });
  return { text: out.replace(/\s{2,}/g, " ").trim(), handoff };
}

/** El chat de la app no muestra Markdown: se sacan los ** y __ y los # de títulos (D-098). */
export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}
