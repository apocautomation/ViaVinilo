/**
 * Derivación fija, sin pasar por la IA (D-057). El modelo local es chico y a veces no deriva cuando
 * debe; estos casos los define Runamatic ("DERIVACIÓN A ASESOR") y no se dejan librados al modelo.
 */
const RULES: { reason: string; re: RegExp }[] = [
  { reason: "Quiere cancelar o cambiar un pedido", re: /\b(cancel\w*|anul\w*|dar de baja|cambiar (el|mi) pedido|modificar (el|mi) pedido)\b/i },
  { reason: "Reclamo por una falla", re: /\b(reclam\w*|falla\w*|fallado|defect\w*|salió mal|salio mal|vino mal|se despeg\w*|se borr\w*|manch\w*)\b/i },
  { reason: "Pide precio o presupuesto", re: /\b(precio\w*|cu[aá]nto (sale|cuesta|vale|es|ser[ií]a)|presupuesto\w*|cotiz\w*|lista de precios)\b/i },
  { reason: "Manda un comprobante de pago", re: /\b(comprobante|transfer[ií]\w*|ya pagu[eé]|te pagu[eé]|pagu[eé] la seña|seña pagada)\b/i },
  {
    reason: "Pide urgencia o que lo manden a otra sucursal",
    re: /\b(urgente|para hoy|lo antes posible|lo m[aá]s r[aá]pido|env[ií]a(r|n|lo)? a (la )?(sucursal|san juan|chile)|mand(ar|en|alo) a (la )?(sucursal|san juan)|cambi(ar|o) de sucursal)\b/i,
  },
  { reason: "Pide hablar con una persona", re: /\b(asesor\w*|humano|persona|operador\w*|vendedor\w*|alguien del local|hablar con alguien)\b/i },
];

export function fixedHandoff(text: string): string | null {
  return RULES.find((r) => r.re.test(text))?.reason ?? null;
}

/** Lo que el bot le contesta al derivar sin consultar a la IA. */
export function handoffReply(now: Date): string {
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/Argentina/Salta", hour: "numeric", hour12: false }));
  const day = now.toLocaleString("en-US", { timeZone: "America/Argentina/Salta", weekday: "short" });
  const closed = day === "Sun" || (day === "Sat" ? hour >= 13 : hour >= 19 || hour < 8);
  return closed
    ? "Te paso con un asesor del equipo de Via Vinilo. Ahora estamos fuera de horario: te responden por este mismo chat el próximo día hábil."
    : "Te paso con un asesor del equipo de Via Vinilo: te responde por este mismo chat en un rato.";
}
