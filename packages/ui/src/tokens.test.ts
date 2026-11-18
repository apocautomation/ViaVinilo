import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { CONTRAST_PAIRS, cssVariables, logo, palette } from "./tokens";

describe("tokens de color", () => {
  it("calcula el contraste WCAG conocido de blanco sobre negro", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it.each(CONTRAST_PAIRS)("$name pasa WCAG AA (4,5:1)", ({ fg, bg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("D-021: cada escala va de claro a oscuro sin saltos invertidos", () => {
    for (const scale of Object.values(palette)) {
      const hexes = Object.values(scale);
      for (let i = 1; i < hexes.length; i++) {
        expect(contrastRatio(hexes[i]!, "#FFFFFF")).toBeGreaterThan(contrastRatio(hexes[i - 1]!, "#FFFFFF"));
      }
    }
  });

  it("D-021: brand-400 queda cerca del cian del logo", () => {
    const ratio = contrastRatio(palette.brand[400], logo.cyan);
    expect(ratio).toBeLessThan(1.15);
  });

  it("expone variables CSS de escala, logo y semánticas", () => {
    const css = cssVariables();
    expect(css).toContain("--color-brand-600:");
    expect(css).toContain("--color-logo-navy: #090F38;");
    expect(css).toContain("--color-on-primary: #FFFFFF;");
  });
});
