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
  // D-101: el voseo bien conjugado pero sin tilde ("Podes retirarlo"). Solo formas que no son otra
  // palabra: "estas", "pagas" o "vos" quedan como están.
  podes: "podés",
  tenes: "tenés",
  queres: "querés",
  decis: "decís",
  venis: "venís",
  elegis: "elegís",
  pedis: "pedís",
  preferis: "preferís",
  recibis: "recibís",
  retiras: "retirás",
};

/**
 * Frases de "usted" que el modelo usa al derivar (D-101): "un asesor le responde" → "te responde".
 * Solo las que no pueden ser de una tercera persona.
 */
const PHRASES: [RegExp, string][] = [
  [/\b(un asesor(?: del equipo)?(?: de Via Vinilo)?) le (responde|contesta|escribe|va a responder|va a escribir)\b/gi, "$1 te $2"],
  [/\ble (respondemos|contestamos|escribimos|avisamos|pasamos)\b/gi, "te $1"],
  // D-101: imperativo de "tú" antes de lo que se pide ("elige el servicio, escribe medidas").
  ...(
    [
      ["elige", "elegí"],
      ["escribe", "escribí"],
      ["indica", "indicá"],
      ["adjunta", "adjuntá"],
      ["envía", "enviá"],
    ] as const
  ).map(([tu, vos]): [RegExp, string] => [
    new RegExp(`(^|[(,.:;!?¿¡]\\s*|\\s(?:y|o)\\s)${tu}(?= (?:el|la|los|las|tu|tus|un|una|medidas|cantidad|nombre)\\b)`, "giu"),
    `$1${vos}`,
  ]),
];

const RE = new RegExp(`(?<![\\p{L}])(${Object.keys(MAP).join("|")})(?![\\p{L}])`, "giu");

export function toVoseo(text: string): string {
  const phrased = PHRASES.reduce((t, [re, to]) => t.replace(re, to), text);
  return phrased.replace(RE, (word) => {
    const out = MAP[word.toLowerCase()]!;
    return word[0] === word[0]!.toUpperCase() && word[0] !== word[0]!.toLowerCase() ? out[0]!.toUpperCase() + out.slice(1) : out;
  });
}
