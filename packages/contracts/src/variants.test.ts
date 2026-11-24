import { describe, expect, it } from "vitest";
import { DEFAULT_SECTOR_VARIANTS, createVariantSchema, detectVariant } from "./variants";

const dtf = (DEFAULT_SECTOR_VARIANTS.DTF ?? []).map((v) => ({ ...v, id: v.code }));

describe("materiales por tablero (D-095)", () => {
  it("D-095: DTF Textil trae las nueve opciones que pasó Ricardo, con códigos únicos", () => {
    expect(dtf.map((v) => v.name)).toEqual(["Normal", "Reflectivo", "Fluorescente", "Glitter", "Dorado", "Plateado", "Oro", "Plata", "Color change"]);
    expect(new Set(dtf.map((v) => v.code)).size).toBe(9);
  });

  it("D-095: el código se escribe en mayúsculas y sin espacios", () => {
    expect(createVariantSchema.parse({ code: " dtf-gli ", name: "Glitter" }).code).toBe("DTF-GLI");
    expect(createVariantSchema.safeParse({ code: "DTF GLI", name: "Glitter" }).success).toBe(false);
  });

  it("D-095: reconoce en un mail el material por el nombre o por el código, solo si nombra uno", () => {
    expect(detectVariant("Remeras en GLITTER, 58 x 100", dtf)).toBe("DTF-GLI");
    expect(detectVariant("van en color change", dtf)).toBe("DTF-CCH");
    expect(detectVariant("código DTF-REF por favor", dtf)).toBe("DTF-REF");
    expect(detectVariant("fluorescente o reflectivo, lo que convenga", dtf)).toBeNull();
    // "normal" suelto no alcanza: "tamaño normal" no es elegir DTF Normal.
    expect(detectVariant("tamaño normal, 58 de ancho", dtf)).toBeNull();
    expect(detectVariant("Remeras 58 x 100", dtf)).toBeNull();
    // "plata" no es "plateado" ni al revés.
    expect(detectVariant("en plata", dtf)).toBe("DTF-PLT");
    expect(detectVariant("en plateado", dtf)).toBe("DTF-PLA");
  });
});
