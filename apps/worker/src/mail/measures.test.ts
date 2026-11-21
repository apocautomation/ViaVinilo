import { describe, expect, it } from "vitest";
import { extractTransferLinks } from "./links";
import { assumePair, extractMeasures } from "./measures";

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

describe("medidas pegadas o sin unidad (D-071)", () => {
  it("D-071: lee la unidad pegada a la x", () => {
    expect(extractMeasures("TELA-153.091CMX185.181CM-URGENTE")).toMatchObject([{ widthCm: 153.09, heightCm: 185.18 }]);
    expect(extractMeasures("lona 2mx1m")).toMatchObject([{ widthCm: 200, heightCm: 100 }]);
  });

  it("D-071: una palabra que empieza con m no se toma como metros", () => {
    expect(extractMeasures("30 maria")).toEqual([]);
  });

  it("D-071: supone la unidad de un par sin unidad según el número", () => {
    expect(assumePair("58x30")).toEqual({ widthCm: 58, heightCm: 30 });
    expect(assumePair("58 ×30")).toEqual({ widthCm: 58, heightCm: 30 });
    expect(assumePair("0.58x0.40")).toEqual({ widthCm: 58, heightCm: 40 });
    expect(assumePair("1.50 X 40")).toEqual({ widthCm: 150, heightCm: 40 });
    expect(assumePair("1,20 x 2")).toEqual({ widthCm: 120, heightCm: 200 });
    expect(assumePair("385X145")).toEqual({ widthCm: 385, heightCm: 145 });
  });

  it("D-071: si el número es dudoso no supone nada", () => {
    expect(assumePair("2481×3508")).toBeNull(); // píxeles
    expect(assumePair("568 X 1.598")).toBeNull(); // ¿1,598 m o 1598?
    expect(assumePair("5 x 7")).toBeNull();
    expect(assumePair("58 x 30 cm")).toBeNull(); // ya tiene unidad: no es este caso
  });
});
