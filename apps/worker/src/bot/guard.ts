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
