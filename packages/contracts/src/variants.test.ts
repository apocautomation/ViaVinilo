import { describe, expect, it } from "vitest";
import { DEFAULT_SECTOR_VARIANTS, createVariantSchema, detectVariant } from "./variants";

const withIds = (list: { code: string; name: string }[] = []) => list.map((v) => ({ ...v, id: v.code }));
const dtf = withIds(DEFAULT_SECTOR_VARIANTS.DTF);
const telas = withIds(DEFAULT_SECTOR_VARIANTS.CALANDRADO);

describe("opciones de impresión por tablero (D-095, D-108)", () => {
  it("D-108: trae el catálogo de los Excel de Ricardo, con código SKU de Tango y anchos, sin precios", () => {
    expect(dtf.map((v) => v.name)).toEqual(["Normal", "Glitter", "Dorado", "Plateado", "Fotoluminiscente", "Color change", "Plata sólida"]);
    expect(DEFAULT_SECTOR_VARIANTS.DTF_UV).toHaveLength(1);
    expect(DEFAULT_SECTOR_VARIANTS.CALANDRADO).toHaveLength(39);
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

  it("D-108: los códigos y los SKU no se repiten en todo el sistema, y los códigos valen para el formulario", () => {
    const all = Object.values(DEFAULT_SECTOR_VARIANTS).flat();
    expect(new Set(all.map((v) => v.code)).size).toBe(all.length);
    expect(new Set(all.map((v) => v.tangoSku)).size).toBe(all.length);
    for (const v of all) expect(createVariantSchema.safeParse({ code: v.code, name: v.name }).success).toBe(true);
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
