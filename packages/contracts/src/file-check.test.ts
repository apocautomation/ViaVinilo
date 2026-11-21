import { describe, expect, it } from "vitest";
import { checkFile, readImageInfo } from "./file-check";

/** Cabecera mínima de un PNG con ese tamaño. */
function png(width: number, height: number, colorType = 6): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  b[24] = 8;
  b[25] = colorType;
  return b;
}
/** JPG mínimo: un bloque APP0 y el bloque de tamaño. */
function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255], 20);
  return b;
}
const dtf = { sectorCode: "DTF", sectorName: "DTF", filename: "a.png" };

describe("control automático del archivo (D-047, D-065)", () => {
  it("D-047: lee el tamaño en píxeles de un PNG y de un JPG", () => {
    expect(readImageInfo(png(1500, 2000))).toEqual({ format: "png", width: 1500, height: 2000, hasAlpha: true });
    expect(readImageInfo(png(10, 10, 2))?.hasAlpha).toBe(false);
    expect(readImageInfo(jpeg(3000, 1200))).toEqual({ format: "jpeg", width: 3000, height: 1200 });
    expect(readImageInfo(new TextEncoder().encode("%PDF-1.4"))).toBeNull();
  });

  it("D-047: el ejemplo de Via Vinilo: 1500 px para 58 cm son 66 dpi aunque el archivo diga 300 → error", () => {
    const r = checkFile({ ...dtf, image: readImageInfo(png(1500, 2586)), measures: [{ widthCm: 58, heightCm: 100 }] });
    expect(r).toMatchObject({ verdict: "error", reasonCode: "LOW_RESOLUTION", effectiveDpi: 66 });
    expect(r.detail).toContain("da 66 dpi; el mínimo para DTF es 250");
  });

  it("D-065: apenas por debajo del mínimo solo se sugiere; con el mínimo está bien", () => {
    // 58 cm = 22,83"; 4000 px → 175 dpi (entre 125 y 250).
    expect(checkFile({ ...dtf, image: readImageInfo(png(4000, 6900)), measures: [{ widthCm: 58, heightCm: 100 }] }).verdict).toBe("review");
    expect(checkFile({ ...dtf, image: readImageInfo(png(6850, 11811)), measures: [{ widthCm: 58, heightCm: 100 }] }).verdict).toBe("ok");
    // Gran Formato pide 100 dpi: lo mismo que en DTF es error, acá alcanza.
    expect(checkFile({ sectorCode: "GRAN_FORMATO", sectorName: "Gran Formato", filename: "l.jpg", image: readImageInfo(jpeg(2400, 4000)), measures: [{ widthCm: 58, heightCm: 100 }] }).verdict).toBe("ok");
  });

  it("D-065: el archivo girado no cuenta como error", () => {
    expect(checkFile({ ...dtf, image: readImageInfo(png(11811, 6850)), measures: [{ widthCm: 58, heightCm: 100 }] }).verdict).toBe("ok");
  });

  it("D-065: sin medida clara o con un archivo que no es imagen, no opina", () => {
    expect(checkFile({ ...dtf, image: readImageInfo(png(100, 100)), measures: [] }).verdict).toBe("unknown");
    expect(checkFile({ ...dtf, image: readImageInfo(png(100, 100)), measures: [{ widthCm: 58, heightCm: 100 }, { widthCm: 30, heightCm: 40 }] }).verdict).toBe("unknown");
    expect(checkFile({ ...dtf, image: readImageInfo(png(100, 100)), measures: [{ widthCm: 58 }] }).verdict).toBe("unknown");
    expect(checkFile({ ...dtf, filename: "a.pdf", image: null, measures: [{ widthCm: 58, heightCm: 100 }] }).verdict).toBe("unknown");
  });
});
