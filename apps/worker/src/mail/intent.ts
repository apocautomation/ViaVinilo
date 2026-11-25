/**
 * Qué quiere el cliente con un mail (D-111), mirando solo lo que escribió él: en una respuesta, el texto
 * citado y el asunto son del mail anterior ("Re: PEDIDO CANCELADO" era un mail del taller pidiéndole el
 * archivo corregido, y el cliente contestaba "te lo vuelvo a enviar").
 */

/** "Re:", "RE:", "RV:", "Fwd:", "Reenviar:"… */
export const isReplySubject = (subject: string | null | undefined) => !!subject && /^\s*(re|rv|fw|fwd|reenv\w*)\s*:/i.test(subject);

/** Corta donde empieza lo citado: "> …", "El jue, … escribió:", "On … wrote:", "-----Mensaje original-----", "De: …". */
export function ownText(text: string): string {
  const cuts = [
    /\n[ \t]*>/,
    /\n[^\n]*\bEl [^\n]{0,200}(\n[^\n]{0,200})?escribi[oó]:/,
    /\n[^\n]*\bOn [^\n]{0,200}(\n[^\n]{0,200})?wrote:/,
    /\n[ \t]*-{2,}[ \t]*(mensaje original|original message|forwarded message|mensaje reenviado)/i,
    /\n[ \t]*\*?(De|From):\*?[ \t]/,
  ];
  const src = `\n${text}`;
  let end = src.length;
  for (const re of cuts) {
    const m = re.exec(src);
    if (m && m.index < end) end = m.index;
  }
  return src.slice(1, Math.max(0, end)).trim();
}

/**
 * Pide cancelar o anular un pedido. "Cancelar" también es pagar ("cancelo el saldo al retirar"): eso no
 * cuenta. "Cancelado" tampoco: describe, no pide.
 */
const CANCEL = /\b(cancel(ar|en|enlo|enla|enlos|alo|ala|ame|amos|á|a)|anul(ar|en|enlo|alo|á|a)|dar de baja|elimin(ar|en|enlo|alo|á|a)\s+(el|ese|este|mi|los|esos|estos|mis)\s+pedidos?)\b/i;
const PAYMENT = /\bcancel\w*\s+(el|la|lo)?\s*(saldo|deuda|total|resto|monto|importe|pago|factura|cuenta)\b/i;

export function asksToCancel(mail: { subject: string | null; text: string }): boolean {
  const words = `${isReplySubject(mail.subject) ? "" : (mail.subject ?? "")}\n${ownText(mail.text)}`;
  return CANCEL.test(words) && !PAYMENT.test(words);
}

/** Saludos y cierres sueltos: no sirven como descripción. */
const FILLER = /^(hola|buenas?|buen d[ií]a|buenas (tardes|noches)|estimad[oa]s?|gracias|muchas gracias|saludos|ok|dale)[\s,.!¡]*$/i;
const meaningful = (line: string) => /\p{L}[^\p{L}]*\p{L}[^\p{L}]*\p{L}/u.test(line) && !/^([<_*-]|https?:)/i.test(line) && !FILLER.test(line);
const PREFIX = /^\s*((re|rv|fw|fwd|reenv\w*)\s*:\s*)+/i;

/**
 * Descripción del pedido que crea un mail (D-111). En un reenvío ("Fwd:") el asunto es el del pedido
 * original: va sin el prefijo. En una respuesta ("Re:") el asunto es el del mail anterior, que puede ser
 * del taller ("PEDIDO CANCELADO"): adelante va lo que escribió el cliente y el asunto queda como
 * referencia, "Te lo vuelvo a enviar. (en respuesta a «PEDIDO CANCELADO»)". Si el cliente solo saludó o
 * mandó un link, queda el asunto.
 */
export function jobDescription(subject: string | null, text: string): string | null {
  if (!subject || !isReplySubject(subject)) return subject;
  const clean = subject.replace(PREFIX, "").trim() || null;
  if (!/^\s*(re|rv)\s*:/i.test(subject)) return clean;
  const line = ownText(text)
    .split("\n")
    .map((l) => l.trim())
    .find(meaningful);
  if (!line) return clean;
  return clean ? `${line.slice(0, 80)} (en respuesta a «${clean}»)` : line.slice(0, 120);
}
