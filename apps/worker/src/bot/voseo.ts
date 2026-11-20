/**
 * Pasa a "vos" las formas de "tú" más comunes (D-060). El modelo local es chico y a veces se le
 * escapa el "tú" aunque el prompt diga lo contrario. Solo formas que no se confunden con otras
 * palabras (por ejemplo, no toca "consultas", que también es un sustantivo).
 */
const MAP: Record<string, string> = {
  tienes: "tenés",
  puedes: "podés",
  quieres: "querés",
  necesitas: "necesitás",
  sabes: "sabés",
  debes: "debés",
  eres: "sos",
  vienes: "venís",
  haces: "hacés",
  mandas: "mandás",
  prefieres: "preferís",
  deseas: "deseás",
  buscas: "buscás",
  entiendes: "entendés",
  recuerdas: "recordás",
  "asegúrate": "asegurate",
  "fíjate": "fijate",
  "comunícate": "comunicate",
  "escríbenos": "escribinos",
  "avísanos": "avisanos",
  "envíanos": "mandanos",
  "envíalo": "mandalo",
  "mándalo": "mandalo",
  "mándanos": "mandanos",
  "envíame": "mandame",
  "tú": "vos",
  contigo: "con vos",
};

const RE = new RegExp(`(?<![\\p{L}])(${Object.keys(MAP).join("|")})(?![\\p{L}])`, "giu");

export function toVoseo(text: string): string {
  return text.replace(RE, (word) => {
    const out = MAP[word.toLowerCase()]!;
    return word[0] === word[0]!.toUpperCase() && word[0] !== word[0]!.toLowerCase() ? out[0]!.toUpperCase() + out.slice(1) : out;
  });
}
