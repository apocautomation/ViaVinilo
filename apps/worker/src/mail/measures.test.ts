import { describe, expect, it } from "vitest";
import { extractTransferLinks } from "./links";
import { extractMeasures } from "./measures";

describe("medidas declaradas en el mail", () => {
  it("lee ancho x alto con la unidad al final", () => {
    expect(extractMeasures("Necesito 1,20 x 0,80 m en vinilo blanco")).toEqual([
      { raw: "1,20 x 0,80 m", widthCm: 120, heightCm: 80 },
    ]);
  });

  it("lee centímetros, milímetros y el signo ×", () => {
    expect(extractMeasures("logo de 30x40cm y otro de 150 mm × 200 mm")).toEqual([
      { raw: "30x40cm", widthCm: 30, heightCm: 40 },
      { raw: "150 mm × 200 mm", widthCm: 15, heightCm: 20 },
    ]);
  });

  it("lee un largo suelto en metros", () => {
    expect(extractMeasures("son 3 metros de DTF")).toEqual([{ raw: "3 metros", lengthCm: 300 }]);
  });

  it("sin unidad guarda el texto pero no inventa centímetros", () => {
    expect(extractMeasures("medida 50x70")).toEqual([{ raw: "50x70", widthCm: undefined, heightCm: undefined }]);
  });

  it("la misma medida en el asunto y en el cuerpo se guarda una vez", () => {
    expect(extractMeasures("Pedido 30x40cm\nVan 3 diseños de 30 x 40 cm")).toEqual([
      { raw: "30x40cm", widthCm: 30, heightCm: 40 },
    ]);
  });

  it("un mail sin medidas no devuelve nada", () => {
    expect(extractMeasures("Hola, te mando el archivo. Gracias!")).toEqual([]);
  });
});

describe("links de transferencia", () => {
  it("guarda WeTransfer y Drive y descarta el resto", () => {
    const text = `Archivo pesado: https://we.tl/t-AbC123. También https://drive.google.com/file/d/xyz/view
      y mi web https://miempresa.com.ar`;
    expect(extractTransferLinks(text)).toEqual([
      "https://we.tl/t-AbC123",
      "https://drive.google.com/file/d/xyz/view",
    ]);
  });

  it("no repite el mismo link del texto y del HTML", () => {
    const url = "https://wetransfer.com/downloads/abc";
    expect(extractTransferLinks(url, `<a href="${url}">${url}</a>`)).toEqual([url]);
  });
});
