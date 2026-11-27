import { describe, expect, it } from "vitest";
import { DEFAULT_SECTOR_VARIANTS, createVariantSchema, detectVariant } from "./variants";

const withIds = (list: { code: string; name: string }[] = []) => list.map((v) => ({ ...v, id: v.code }));
const dtf = withIds(DEFAULT_SECTOR_VARIANTS.DTF);
const telas = withIds(DEFAULT_SECTOR_VARIANTS.CALANDRADO);

describe("opciones de impresión por tablero (D-095, D-108)", () => {
  it("D-108: trae el catálogo de los Excel de Ricardo, con código SKU de Tango y anchos, sin precios", () => {
    expect(dtf.map((v) => v.name)).toEqual(["Normal", "Glitter", "Dorado", "Plateado", "Fotoluminiscente", "Color change", "Plata sólida"]);
    expect(DEFAULT_SECTOR_VARIANTS.DTF_UV).toHaveLength(1);
    // 39 telas del Excel + "Tela del cliente" (D-113).
    expect(DEFAULT_SECTOR_VARIANTS.CALANDRADO).toHaveLength(40);
    expect(DEFAULT_SECTOR_VARIANTS.SUBLIMACION).toHaveLength(4);
    expect(DEFAULT_SECTOR_VARIANTS.CALANDRADO!.find((v) => v.code === "SET")).toEqual({
      code: "SET",
      name: "Jersey Set Premium",
      tangoSku: "TECA00001",
      width: "160",
      usableWidth: "155",
    });
    expect(DEFAULT_SECTOR_VARIANTS.CALANDRADO!.find((v) => v.code === "COOL")?.tangoSku).toBe("TECA00002");
  });

  it("D-117: los códigos y los SKU no se repiten dentro de cada tablero, y valen para el formulario", () => {
    for (const list of Object.values(DEFAULT_SECTOR_VARIANTS)) {
      expect(new Set(list.map((v) => v.code)).size).toBe(list.length);
      const skus = list.flatMap((v) => (v.tangoSku ? [v.tangoSku] : []));
      expect(new Set(skus).size).toBe(skus.length);
      for (const v of list) expect(createVariantSchema.safeParse({ code: v.code, name: v.name, width: v.width }).success).toBe(true);
    }
    // Solo la tela del cliente no tiene SKU; Gran Formato todavía no tiene los de Tango (TODO(spec): I-30, I-31).
    const pendingSku = new Set(["LATEX", "ECOSOLVENTE", "UV_ROLLO", "UV_RIGIDOS"]);
    const withoutSku = Object.entries(DEFAULT_SECTOR_VARIANTS)
      .filter(([sector]) => !pendingSku.has(sector))
      .flatMap(([, list]) => list.filter((v) => !v.tangoSku).map((v) => v.code));
    expect(withoutSku).toEqual(["TCLI"]);
  });

  it("D-117: lonas y vinilos de Gran Formato con sus anchos de rollo (Excel de Ricardo del 26/11)", () => {
    const latex = DEFAULT_SECTOR_VARIANTS.LATEX!;
    // 21 vinilos y 3 lonas, iguales en Látex y UV rollo a rollo.
    expect(latex).toHaveLength(24);
    expect(DEFAULT_SECTOR_VARIANTS.UV_ROLLO).toEqual(latex);
    expect(latex.find((v) => v.code === "JBB")).toEqual({ code: "JBB", name: "Vinilo Jaspe base blanca", width: "106, 127, 137, 152" });
    expect(latex.find((v) => v.code === "L13B")?.width).toBe("91, 100, 110, 125, 137, 152, 160");
    // Ecosolvente suma la máquina de gran formato: las lonas llegan a 3,20 m y hay lona 8 oz y mesh.
    const eco = DEFAULT_SECTOR_VARIANTS.ECOSOLVENTE!;
    expect(eco).toHaveLength(26);
    expect(eco.find((v) => v.code === "L13B")?.width).toBe("91, 100, 110, 125, 137, 152, 160, 182, 200, 220, 250, 320");
    expect(eco.find((v) => v.code === "L8B")).toEqual({ code: "L8B", name: "Lona 8 oz brillo", width: "250, 320" });
    expect(eco.find((v) => v.code === "LMESH")?.width).toBe("220, 250, 320");
  });

  it("D-118: placas de UV rígidos por material y espesor, con las medidas de placa en cm (Excel de Ricardo del 27/11)", () => {
    const rigid = DEFAULT_SECTOR_VARIANTS.UV_RIGIDOS!;
    expect(rigid).toHaveLength(26);
    expect(rigid.find((v) => v.code === "CORR22")).toEqual({ code: "CORR22", name: "Corrugado 2,2 mm", width: "66x50, 100x100, 100x200" });
    // Las placas de 610x1220 mm del Excel quedan en cm, como el resto de los anchos.
    expect(rigid.find((v) => v.code === "PVC10")).toEqual({ code: "PVC10", name: "PVC espumado 10 mm", width: "61x61, 61x122, 122x122, 122x244" });
    expect(rigid.find((v) => v.code === "AI15")?.width).toBe("50x100, 100x100, 100x200");
    expect(rigid.find((v) => v.code === "ACB5")?.name).toBe("Acrílico blanco traslúcido 5 mm");
    // Cortes vino sin materiales, solo las unidades de cobro. TODO(spec): I-31, cambiar esto si Ricardo manda opciones.
    expect(DEFAULT_SECTOR_VARIANTS.CORTES).toBeUndefined();
  });

  it("D-118: un mail que nombra la placa con su espesor elige esa opción, y sin espesor no elige ninguna", () => {
    const rigid = withIds(DEFAULT_SECTOR_VARIANTS.UV_RIGIDOS);
    expect(detectVariant("cartel en alto impacto 1,5 mm, 100x200", rigid)).toBe("AI15");
    expect(detectVariant("cartel en alto impacto 1 mm", rigid)).toBe("AI1");
    expect(detectVariant("cartel en PVC espumado", rigid)).toBeNull();
    // Sin espacio antes de "mm" no coincide con el nombre: lo elige el taller a mano.
    expect(detectVariant("cartel en alto impacto 3mm", rigid)).toBeNull();
  });

  it("D-108: el código va en mayúsculas, sin espacios ni guiones; SKU y anchos son opcionales", () => {
    expect(createVariantSchema.parse({ code: " set ", name: "Jersey Set" })).toMatchObject({ code: "SET" });
    expect(createVariantSchema.safeParse({ code: "DTF GLI", name: "Glitter" }).success).toBe(false);
    expect(createVariantSchema.safeParse({ code: "DTF-GLI", name: "Glitter" }).success).toBe(false);
    expect(createVariantSchema.parse({ code: "SET", name: "Jersey Set", tangoSku: " TECA00001 ", width: "" })).toMatchObject({ tangoSku: "TECA00001", width: null });
  });

  it("D-095: reconoce en un mail la opción por el nombre o por el código, solo si nombra una", () => {
    expect(detectVariant("Remeras en GLITTER, 58 x 100", dtf)).toBe("GLI");
    expect(detectVariant("van en color change", dtf)).toBe("CCH");
    expect(detectVariant("código PLS por favor", dtf)).toBe("PLS");
    expect(detectVariant("glitter o dorado, lo que convenga", dtf)).toBeNull();
    // "normal" suelto no alcanza: "tamaño normal" no es elegir DTF Normal.
    expect(detectVariant("tamaño normal, 58 de ancho", dtf)).toBeNull();
    expect(detectVariant("Remeras 58 x 100", dtf)).toBeNull();
    expect(detectVariant("en plateado", dtf)).toBe("PLA");
  });

  it("D-108: gana la frase más completa ('polar antipeeling' no es también 'polar')", () => {
    expect(detectVariant("impresión sobre polar antipeeling 3 m", telas)).toBe("POLAP");
    expect(detectVariant("impresión sobre polar 3 m", telas)).toBe("POLAR");
    expect(detectVariant("Set de microfibra premium, 10 m", telas)).toBe("SETMF");
    expect(detectVariant("ideas zaun 300 x 155 jersey set", telas)).toBe("SET");
    expect(detectVariant("calandrado sobre tropical", telas)).toBe("TROP");
    expect(detectVariant("tropical y lycra", telas)).toBeNull();
  });
});
