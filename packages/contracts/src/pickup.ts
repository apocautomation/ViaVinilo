import { z } from "zod";

/**
 * Sucursal donde el cliente retira el pedido (D-083). Los ids son los de la Ayuda (`help.BRANCHES`).
 * Una camioneta cruza pedidos entre las dos sucursales dos veces por día, así que el cliente puede
 * retirar en cualquiera: lo elige al pedir y el taller lo ve en la tarjeta.
 */
export const PICKUP_BRANCHES = ["chile", "san-juan"] as const;
export type PickupBranch = (typeof PICKUP_BRANCHES)[number];
export const pickupBranchSchema = z.enum(PICKUP_BRANCHES);

/** Como le dicen en Via Vinilo: "la Chile" y "la San Juan". */
export const PICKUP_LABELS: Record<PickupBranch, string> = { chile: "Av. Chile", "san-juan": "San Juan" };

export const isPickupBranch = (v: unknown): v is PickupBranch => typeof v === "string" && (PICKUP_BRANCHES as readonly string[]).includes(v);

/** Sucursal donde se produce cada servicio: DTF Textil, DTF UV y TPU en San Juan; el resto en Av. Chile. */
export function defaultPickupBranch(sectorCode: string): PickupBranch {
  return sectorCode === "DTF" || sectorCode === "DTF_UV" || sectorCode === "TPU" ? "san-juan" : "chile";
}

/**
 * Lee del mail dónde quiere retirar el cliente ("retiro en la San Juan", "lo busco por la Chile").
 * Solo cuenta si lo dice junto a retirar, buscar o pasar: la dirección de la firma no alcanza.
 * Si nombra las dos o ninguna, devuelve null y lo define el asesor.
 */
export function detectPickupBranch(text: string): PickupBranch | null {
  const t = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const found = new Set<PickupBranch>();
  for (const m of t.matchAll(/\b(retir\w*|busc\w*|paso|pasamos|pasan|pasa)\b[^\n]{0,40}?\b(san juan|chile|centro)\b/g)) {
    found.add(m[2] === "chile" ? "chile" : "san-juan");
  }
  return found.size === 1 ? [...found][0]! : null;
}
