/**
 * Agrupación visual por opción de impresión (D-110): con "Agrupar por opción", cada columna muestra los
 * trabajos de la misma tela uno abajo del otro, bajo un encabezado con un color. Es solo visual: cada
 * trabajo sigue siendo un pedido aparte (cotización individual). Así lo pidió Ricardo con su ejemplo:
 * SET… en gris, COOL… en amarillo, COR… en rojo.
 */
export interface GroupableCard {
  variant: { id: string; code: string; name: string } | null;
  material: { id: string; name: string } | null;
}

export interface MaterialGroup<T extends GroupableCard> {
  key: string;
  /** Código de la opción ("SET"), o null si el grupo no tiene opción. */
  code: string | null;
  title: string;
  /** Color del grupo; null para "Sin opción". */
  color: string | null;
  cards: T[];
}

/** Colores bien distintos entre sí. Se reparten en orden dentro de cada columna: dos grupos seguidos nunca comparten color. */
export const MATERIAL_COLORS = ["#9ca3af", "#eab308", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#ec4899", "#84cc16"];

export function groupByMaterial<T extends GroupableCard>(cards: readonly T[]): MaterialGroup<T>[] {
  const groups = new Map<string, MaterialGroup<T>>();
  for (const card of cards) {
    // D-117: por código, así el mismo material de dos sub-servicios de Gran Formato es un solo grupo.
    const key = card.variant ? `v:${card.variant.code}` : card.material ? `m:${card.material.id}` : "none";
    let group = groups.get(key);
    if (!group) {
      group = card.variant
        ? { key, code: card.variant.code, title: card.variant.name, color: null, cards: [] }
        : card.material
          ? { key, code: null, title: card.material.name, color: null, cards: [] }
          : { key, code: null, title: "Sin opción elegida", color: null, cards: [] };
      groups.set(key, group);
    }
    group.cards.push(card);
  }
  // Por código (o nombre); "Sin opción elegida" al final. Dentro de cada grupo queda el orden de llegada.
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.key === "none") return 1;
    if (b.key === "none") return -1;
    return (a.code ?? a.title).localeCompare(b.code ?? b.title, "es");
  });
  let i = 0;
  for (const g of sorted) if (g.key !== "none") g.color = MATERIAL_COLORS[i++ % MATERIAL_COLORS.length]!;
  return sorted;
}
