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

/**
 * Relleno y ofrecimientos que no corresponden (D-104): "Verifico…" al empezar (ya verificó, o no lo hizo),
 * "¿Querés que te ayudemos a preparar el archivo?" (no diseñan ni preparan archivos) y "el resumen"
 * (es el nombre de un dato interno, el cliente no lo ve).
 */
export function dropFiller(text: string): string {
  const opener = /^(?:(?:verifico|reviso|ya (?:lo )?(?:verifico|reviso)|d[eé]jame (?:ver|verificar|revisar)|un momento|un segundo)\b[^.!?…]*(?:\.\.\.|[.!?…])\s*)+/i;
  const out = dropSentencesWith(
    text.replace(opener, ""),
    // "No se requiere seña": de los servicios fuera de las reglas de seña no se sabe; con las reglas, la
    // respuesta armada ya explica cuándo lleva.
    /¿Quer[eé]s que te (ayude|ayudemos|prepare|preparemos|arme|armemos|corrija|corrijamos)\b|\b(en|el|del) resumen\b|\bno (se )?(requiere|aplica|lleva|hace falta|necesita|pide|cobra)\w*[^.!?]{0,15}\bse[ñn]a\b|\bse[ñn]a\b[^.!?]{0,10}\bno (se )?(requiere|aplica|lleva|hace falta|necesita|pide|cobra)\b|\bsin se[ñn]a\b|\bno figura en las reglas\b|\bno (digas|menciones|hables|prometas)\b|¿Quer[eé]s (saber|que te (diga|pase|pasemos|cuente)) (cu[aá]nto (sale|cuesta|es)|el precio|el presupuesto)/i,
  );
  return out || text;
}

/**
 * Si la respuesta nombra una sucursal sin su link del mapa (D-106), se agrega al final. La IA a veces
 * decía "si querés el mapa, mandame el link" o no lo pasaba: se saca esa frase y van los links.
 */
export function ensureMapLinks(text: string): string {
  const missing = help.BRANCHES.filter((b) => text.includes(b.name) && !text.includes(b.mapUrl));
  if (!missing.length) return text;
  const cleaned = dropSentencesWith(text, /\b(mapa|links?)\b/i) || text;
  return `${cleaned}\n\nMapa:\n${missing.map((b) => `${b.name}: ${b.mapUrl}`).join("\n")}`;
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
    // D-106: "[Sucursal Centro](https://…)" no se ve como link en el chat: "Sucursal Centro: https://…".
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2")
    // D-106: el punto pegado al link ("…Gpsviavinilo.") lo rompe en muchos chats.
    .replace(/(https?:\/\/\S*?)[.,;:]+(?=\s|$)/g, "$1")
    .trim();
}
