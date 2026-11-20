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

export function dropNoticePromises(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const kept = sentences.filter((s) => !/\bte (avisamos|avisaremos|vamos a avisar|notificamos)\b/i.test(s));
  const out = kept.join("").trim();
  return out || text;
}
