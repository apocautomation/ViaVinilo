import { z } from "zod";

/**
 * Tableros de base de Via Vinilo (SPEC §1). Desde D-064 se pueden crear más desde el ERP, así que el
 * código de un tablero es texto: mayúsculas, números y guion bajo.
 */
export const SECTOR_CODES = ["DTF", "DTF_UV", "TPU", "GRAN_FORMATO", "LATEX", "ECOSOLVENTE", "UV_ROLLO", "UV_RIGIDOS", "CORTES", "CALANDRADO", "SUBLIMACION"] as const;
export type BaseSectorCode = (typeof SECTOR_CODES)[number];

export const sectorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,29}$/, "Tablero inválido");
export type SectorCode = string;

/** "TPU / Embroidery" → "TPU_EMBROIDERY". */
export function sectorCodeFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "T_$1")
    .slice(0, 30);
}

/** Alta de un tablero desde el ERP (D-064). */
export const createSectorSchema = z.object({
  name: z.string().trim().min(2, "Poné un nombre").max(40),
  /** Casilla de mail del tablero (opcional): los mails que lleguen ahí crean pedidos en este tablero. */
  inboxEmail: z.union([z.literal("").transform(() => undefined), z.string().trim().toLowerCase().email("Email inválido")]).optional(),
  /** Con el paso "En proceso de calandra" (como Sublimación y Calandrado). */
  withCalender: z.boolean().default(false),
});
export const updateSectorSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    inboxEmail: z.union([z.literal("").transform(() => null), z.null(), z.string().trim().toLowerCase().email("Email inválido")]),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");

export const SECTOR_NAMES: Record<BaseSectorCode, string> = {
  DTF: "DTF Textil",
  DTF_UV: "DTF UV",
  TPU: "TPU",
  GRAN_FORMATO: "Gran Formato",
  LATEX: "Látex",
  ECOSOLVENTE: "Ecosolvente",
  UV_ROLLO: "UV rollo a rollo",
  UV_RIGIDOS: "UV rígidos",
  CORTES: "Cortes",
  CALANDRADO: "Calandrado",
  SUBLIMACION: "Sublimación",
};

/**
 * Sub-servicios (D-082, reunión del 24/11): los cinco sistemas de impresión de Gran Formato son
 * tableros hijos. Se ven todos juntos en el tablero de Gran Formato y cada pedido dice cuál es.
 */
export const SECTOR_PARENT: Partial<Record<BaseSectorCode, BaseSectorCode>> = {
  LATEX: "GRAN_FORMATO",
  ECOSOLVENTE: "GRAN_FORMATO",
  UV_ROLLO: "GRAN_FORMATO",
  UV_RIGIDOS: "GRAN_FORMATO",
  CORTES: "GRAN_FORMATO",
};

/**
 * Parte local de la casilla de mail de cada sector (SPEC E1.1). El dominio va por entorno.
 * Los tableros nuevos de D-082 nacen sin casilla: se les pone desde Configuración (`cortes@`, `tpu@`).
 */
export const SECTOR_INBOX_LOCAL_PART: Partial<Record<BaseSectorCode, string>> = {
  DTF: "dtf",
  DTF_UV: "dtfuv",
  GRAN_FORMATO: "granformato",
  LATEX: "latex",
  CALANDRADO: "calandra",
  SUBLIMACION: "sublimacion",
};

/**
 * Tableros que no cuelgan de otro pero reciben sus pedidos por la casilla de otro (D-092): TPU no
 * tiene casilla propia y sus mails llegan a la de DTF Textil.
 */
export const SECTOR_SHARED_INBOX: Partial<Record<BaseSectorCode, BaseSectorCode[]>> = {
  DTF: ["TPU"],
  DTF_UV: ["TPU"],
};

/**
 * Palabras que identifican un sub-servicio en el texto de un mail (D-092). Son a propósito pocas y
 * claras: "corte" suelto no cuenta, porque casi cualquier pedido de vinilo dice "con corte".
 */
const SUBSERVICE_WORDS: { code: BaseSectorCode; re: RegExp }[] = [
  { code: "LATEX", re: /\blatex\b/ },
  { code: "ECOSOLVENTE", re: /\beco ?solvente\b/ },
  { code: "UV_ROLLO", re: /\buv\b.{0,20}\brollo\b|\brollo a rollo\b/ },
  { code: "UV_RIGIDOS", re: /\buv\b.{0,20}\brigid\w*|\brigidos?\b|\bcama plana\b/ },
  { code: "CORTES", re: /\b(ploteo|plotter|servicio|trabajo|pedido) de cortes?\b|\b(solo|solamente|para) cortes?\b|^\s*cortes?\b/m },
  { code: "TPU", re: /\btpu\b/ },
];

/**
 * A qué sub-servicio corresponde un mail según lo que dice, entre los candidatos de esa casilla.
 * Devuelve el código solo si nombra exactamente uno; si nombra varios o ninguno, null (queda en el
 * tablero de la casilla y lo clasifica una persona).
 */
export function detectSubService(text: string, candidates: readonly string[]): string | null {
  const plain = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const found = new Set(SUBSERVICE_WORDS.filter((w) => candidates.includes(w.code) && w.re.test(plain)).map((w) => w.code));
  return found.size === 1 ? [...found][0]! : null;
}
