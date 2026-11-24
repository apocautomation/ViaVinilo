import { z } from "zod";
import type { BaseSectorCode } from "./sectors";

/**
 * Materiales u opciones de impresión de cada tablero (D-095): en DTF Textil "Glitter", "Reflectivo"…;
 * en Calandra la tela ("Jersey Set"). El cliente lo elige al mandar el trabajo y el pedido queda con
 * un código ("DTF-GLI") que sirve para identificarlo y para agrupar los trabajos del mismo material.
 */
export interface VariantSeed {
  code: string;
  name: string;
}

/** Lo que pasó Ricardo el 24/11. Los demás tableros se cargan con el Excel del cliente. TODO(spec): I-28. */
export const DEFAULT_SECTOR_VARIANTS: Partial<Record<BaseSectorCode, VariantSeed[]>> = {
  DTF: [
    { code: "DTF-NOR", name: "Normal" },
    { code: "DTF-REF", name: "Reflectivo" },
    { code: "DTF-FLU", name: "Fluorescente" },
    { code: "DTF-GLI", name: "Glitter" },
    { code: "DTF-DOR", name: "Dorado" },
    { code: "DTF-PLA", name: "Plateado" },
    { code: "DTF-ORO", name: "Oro" },
    { code: "DTF-PLT", name: "Plata" },
    { code: "DTF-CCH", name: "Color change" },
  ],
};

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "El código va en mayúsculas, números y guiones (ej.: DTF-GLI)");
const name = z.string().trim().min(2, "Poné el nombre").max(40);

export const createVariantSchema = z.object({ code, name });
export const updateVariantSchema = z
  .object({ code, name, active: z.boolean(), sortOrder: z.number().int().min(0).max(999) })
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
 * Qué opción nombra un mail (D-095): por el código ("DTF-GLI") o por el nombre ("glitter"). Solo si
 * nombra exactamente una; si nombra varias o ninguna, null y la elige el taller.
 */
export function detectVariant<T extends { id: string; code: string; name: string }>(text: string, variants: readonly T[]): string | null {
  const t = ` ${plain(text).replace(/[^a-z0-9-]+/g, " ")} `;
  const found = new Set<string>();
  for (const v of variants) {
    const n = plain(v.name).replace(/[^a-z0-9]+/g, " ").trim();
    if (t.includes(` ${plain(v.code)} `) || (!GENERIC.has(n) && n.length >= 3 && t.includes(` ${n} `))) found.add(v.id);
  }
  return found.size === 1 ? [...found][0]! : null;
}
