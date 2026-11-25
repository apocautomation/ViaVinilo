import { z } from "zod";
import type { BaseSectorCode } from "./sectors";

/**
 * Opciones de impresión de cada tablero (D-095, D-102): en DTF Textil "Glitter"; en Calandrado la tela
 * ("Jersey Set Premium"). El cliente la elige al mandar el trabajo y el pedido queda con su código
 * ("SET"), que sirve para identificarlo y para agrupar los trabajos del mismo material.
 */
export interface VariantSeed {
  /** Código corto (D-108): letras y números, sin guiones. Va adelante del número en el ERP ("SET-000002"). */
  code: string;
  name: string;
  /** Código del artículo en Tango (D-108). */
  tangoSku?: string;
  /** Ancho del material y ancho útil de impresión, en cm (A4: "21x29,7"). */
  width?: string;
  usableWidth?: string;
}

type Row = [code: string, name: string, tangoSku: string, width: string, usableWidth: string];
/** Vacío = sin dato (la tela del cliente no tiene SKU ni ancho propio). */
const rows = (list: Row[]): VariantSeed[] =>
  list.map(([code, name, tangoSku, width, usableWidth]) => ({
    code,
    name,
    ...(tangoSku ? { tangoSku } : {}),
    ...(width ? { width } : {}),
    ...(usableWidth ? { usableWidth } : {}),
  }));

/**
 * Catálogo que pasó Ricardo el 25/11 en los Excel "DETALLE …" (D-108): nombre, ancho, ancho útil y código
 * SKU de Tango, sin precios (se cotiza a mano por ahora). Los códigos cortos los propuse yo a partir del
 * nombre; Ricardo dio de ejemplo SET (Jersey Set) y COOL (Cool Dry Fit). TODO(spec): I-28, confirmar los
 * demás códigos con Ricardo.
 */
export const DEFAULT_SECTOR_VARIANTS: Partial<Record<BaseSectorCode, VariantSeed[]>> = {
  DTF: rows([
    ["NOR", "Normal", "IMDT00004", "60", "58"],
    ["GLI", "Glitter", "IMDT00009", "60", "58"],
    ["DOR", "Dorado", "IMDT00011", "60", "58"],
    ["PLA", "Plateado", "IMDT00010", "60", "58"],
    ["FOTO", "Fotoluminiscente", "IMDT00012", "60", "58"],
    ["CCH", "Color change", "IMDT00013", "60", "58"],
    ["PLS", "Plata sólida", "IMDT00028", "60", "58"],
  ]),
  DTF_UV: rows([["UVN", "Normal", "IMDT00032", "60", "58"]]),
  CALANDRADO: rows([
    ["ACET", "Acetato", "TECA00003", "160", "155"],
    ["BAN70", "Bandera 70 gr", "TECA00039", "150", "145"],
    ["BAN100", "Bandera 100 gr", "TECA00040", "160", "155"],
    ["CAS", "Cas Premium", "TECA00028", "160", "155"],
    ["CIRE", "Cire", "TECA00019", "150", "145"],
    ["CORDE", "Corderito", "TECA00044", "160", "155"],
    ["CORDU", "Cordura", "TECA00016", "135", "130"],
    ["COOL", "Cool Dry Fit", "TECA00002", "160", "155"],
    ["DEPF", "Deportivo frizado", "TECA00006", "160", "155"],
    ["DEPSF", "Deportivo sin friza", "TECA00005", "150", "145"],
    ["FIBV", "Fibra vinílica", "TECA00041", "120", "115"],
    ["FIFA", "FIFA - AFA", "TECA00034", "160", "155"],
    ["SET", "Jersey Set Premium", "TECA00001", "160", "155"],
    ["KET", "Ketten", "TECA00007", "160", "155"],
    ["LYC", "Lycra", "TECA00009", "160", "155"],
    ["MESH", "Mesh", "TECA00035", "150", "145"],
    ["MESSI", "Messi", "TECA00031", "160", "155"],
    ["MELAS", "Microelastic", "TECA00037", "150", "145"],
    ["MFIB", "Microfibra", "TECA00012", "150", "145"],
    ["MODAL", "Modal", "TECA00014", "160", "155"],
    ["NBA", "NBA", "TECA00036", "160", "155"],
    ["NIKE", "Nike", "TECA00045", "160", "155"],
    ["PANC", "Panal calado", "TECA00042", "160", "155"],
    ["PANA", "Panal de abeja", "TECA00029", "160", "155"],
    ["PIQ", "Piquet deportivo", "TECA00023", "160", "155"],
    ["PIXEL", "Pixel doble rebote", "TECA00038", "160", "155"],
    ["POLAR", "Polar", "TECA00008", "160", "155"],
    ["POLAP", "Polar antipeeling", "TECA00043", "160", "155"],
    ["RASO", "Raso", "TECA00020", "150", "145"],
    ["SILV", "Silver", "TECA00018", "150", "145"],
    ["SETMF", "Set de microfibra premium", "TECA00027", "160", "155"],
    ["SOFT", "Soft shell", "TECA00032", "160", "155"],
    ["SPUN", "Spun", "TECA00004", "160", "155"],
    ["TAF", "Tafeta", "TECA00013", "150", "145"],
    ["TOA", "Toalla", "TECA00015", "150", "145"],
    ["TROP", "Tropical", "TECA00010", "150", "145"],
    ["TUCK", "Tucker", "TECA00017", "150", "145"],
    ["MPOC", "Modelo POC set de microfibra", "TECA00024", "160", "155"],
    ["MSET", "Modelo Jersey Set", "TECA00025", "160", "155"],
    // D-113 (Verónica): la tela que trae el cliente se imprime aparte, no se junta con la de Via Vinilo.
    ["TCLI", "Tela del cliente", "", "", ""],
  ]),
  SUBLIMACION: rows([
    ["P80A160", "Papel 80 gr (160 cm)", "IMSU00018", "160", "157"],
    ["P35", "Papel 35 gr", "IMSU00021", "160", "157"],
    ["P80A110", "Papel 80 gr (110 cm)", "IMSU00005", "110", "108"],
    ["A4", "A4", "IMSU00004", "21x29,7", "20x28"],
  ]),
};

const code = z
  .string()
  .trim()
  .toUpperCase()
  // D-108: sin guiones, para que "SET-000002" se lea sin ambigüedad (código + número).
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, "El código va en mayúsculas y números, sin espacios ni guiones (ej.: SET)");
const name = z.string().trim().min(2, "Poné el nombre").max(40);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const createVariantSchema = z.object({ code, name, tangoSku: optional(30), width: optional(20), usableWidth: optional(20) });
export const updateVariantSchema = z
  .object({
    code,
    name,
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(999),
    tangoSku: optional(30),
    width: optional(20),
    usableWidth: optional(20),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");

/** Palabras que no alcanzan para decir que el cliente eligió esa opción ("tamaño normal"). */
const GENERIC = new Set(["normal", "comun", "estandar", "standard", "clasico"]);
const plain = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Qué opción nombra un mail (D-095): por el código ("SET") o por el nombre ("glitter"). Solo si nombra
 * exactamente una; si nombra varias o ninguna, null y la elige el taller. D-108: gana la frase más
 * completa, así "polar antipeeling" no es también "polar" ni "set de microfibra premium" es "set".
 */
export function detectVariant<T extends { id: string; code: string; name: string }>(text: string, variants: readonly T[]): string | null {
  const t = ` ${plain(text).replace(/[^a-z0-9-]+/g, " ")} `;
  const hits: { id: string; phrase: string }[] = [];
  for (const v of variants) {
    const n = plain(v.name).replace(/[^a-z0-9]+/g, " ").trim();
    const c = plain(v.code);
    if (t.includes(` ${c} `)) hits.push({ id: v.id, phrase: c });
    if (!GENERIC.has(n) && n.length >= 3 && t.includes(` ${n} `)) hits.push({ id: v.id, phrase: n });
  }
  const kept = hits.filter((h) => !hits.some((o) => o.id !== h.id && o.phrase !== h.phrase && ` ${o.phrase} `.includes(` ${h.phrase} `)));
  const found = new Set(kept.map((h) => h.id));
  return found.size === 1 ? [...found][0]! : null;
}
