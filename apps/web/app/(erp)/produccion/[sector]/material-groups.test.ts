import { describe, expect, it } from "vitest";
import { MATERIAL_COLORS, groupByMaterial } from "./material-groups";

const card = (id: string, variant?: { code: string; name: string }) => ({
  id,
  variant: variant ? { id: variant.code, ...variant } : null,
  material: null,
});

describe("agrupación visual por opción de impresión (D-110)", () => {
  it("D-110: junta los trabajos de la misma tela uno abajo del otro, con un color por grupo; sin opción va al final", () => {
    const set = { code: "SET", name: "Jersey Set Premium" };
    const cool = { code: "COOL", name: "Cool Dry Fit" };
    const groups = groupByMaterial([card("1", set), card("2", cool), card("3"), card("4", set), card("5", cool), card("6", set)]);
    expect(groups.map((g) => [g.code, g.cards.map((c) => c.id)])).toEqual([
      ["COOL", ["2", "5"]],
      ["SET", ["1", "4", "6"]],
      [null, ["3"]],
    ]);
    expect(groups.map((g) => g.color)).toEqual([MATERIAL_COLORS[0], MATERIAL_COLORS[1], null]);
    expect(groups[2]!.title).toBe("Sin opción elegida");
  });

  it("D-110: dos grupos seguidos nunca tienen el mismo color", () => {
    const groups = groupByMaterial(Array.from({ length: 12 }, (_, i) => card(String(i), { code: `T${String(i).padStart(2, "0")}`, name: `Tela ${i}` })));
    for (let i = 1; i < groups.length; i++) expect(groups[i]!.color).not.toBe(groups[i - 1]!.color);
  });

  it("D-117: el mismo código de dos sub-servicios (Látex y Ecosolvente) es un solo grupo", () => {
    const inLatex = { id: "1", variant: { id: "latex-jbb", code: "JBB", name: "Vinilo Jaspe base blanca" }, material: null };
    const inEco = { id: "2", variant: { id: "eco-jbb", code: "JBB", name: "Vinilo Jaspe base blanca" }, material: null };
    expect(groupByMaterial([inLatex, inEco]).map((g) => [g.code, g.cards.map((c) => c.id)])).toEqual([["JBB", ["1", "2"]]]);
  });
});
