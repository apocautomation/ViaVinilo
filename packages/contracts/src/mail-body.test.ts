import { describe, expect, it } from "vitest";
import { parseMailBody } from "./mail-body";

const LAURA = `Estimados, Adjunto ARCHIVOS
CALANDRA, TELA METÁNICA TROPICAL


6 PAÑOS DIFERENTES DE 4,00 x 1,40 CADA UNO
 Carpinteria_A.jpg
<https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view?usp=drive_web>
 Carpinteria_B.jpg
<https://drive.google.com/file/d/1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB/view?usp=drive_web>
 Mar_ A.jpg
<https://drive.google.com/file/d/1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view?usp=drive_web>

LO RETIRO EN SUCURSAL "SAN JUAN"

CLIENTE:
LAURA SOSA`;

describe("mails legibles en Conversaciones (D-057)", () => {
  it("D-057: separa los links de Drive con el nombre de cada archivo y deja el texto tal cual, ordenado", () => {
    const p = parseMailBody(LAURA);
    expect(p.links).toEqual([
      { label: "Carpinteria_A.jpg", url: "https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view?usp=drive_web" },
      { label: "Carpinteria_B.jpg", url: "https://drive.google.com/file/d/1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB/view?usp=drive_web" },
      { label: "Mar_ A.jpg", url: "https://drive.google.com/file/d/1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view?usp=drive_web" },
    ]);
    expect(p.text).toBe(
      'Estimados, Adjunto ARCHIVOS\nCALANDRA, TELA METÁNICA TROPICAL\n\n6 PAÑOS DIFERENTES DE 4,00 x 1,40 CADA UNO\n\nLO RETIRO EN SUCURSAL "SAN JUAN"\n\nCLIENTE:\nLAURA SOSA',
    );
    expect(p.quoted).toBeNull();
  });

  it("D-057: un link con el nombre en la misma línea", () => {
    const p = parseMailBody("lienzo uv.png\n<https://drive.google.com/file/d/1DDD/view?usp=drive_web>");
    expect(p.links).toEqual([{ label: "lienzo uv.png", url: "https://drive.google.com/file/d/1DDD/view?usp=drive_web" }]);
    expect(p.text).toBe("");
    expect(parseMailBody("mirá https://we.tl/t-abc gracias").links).toEqual([{ label: "WeTransfer", url: "https://we.tl/t-abc" }]);
  });

  it("D-057: lo citado de la respuesta automática va aparte y se sabe de quién es", () => {
    const p = parseMailBody(
      "mi archivo es de 58 × 50\n\n\nEl vie, 20 nov 2026 a las 12:44, <dtfuv@viavinilo.com> escribió:\n\n> ¡Hola, recibimos tu pedido! Si el archivo tiene algún inconveniente nos\n> comunicaremos.",
    );
    expect(p.text).toBe("mi archivo es de 58 × 50");
    expect(p.quoted).toBe("El vie, 20 nov 2026 a las 12:44, <dtfuv@viavinilo.com> escribió:\n\n¡Hola, recibimos tu pedido! Si el archivo tiene algún inconveniente nos\ncomunicaremos.");
    expect(p.quotedFrom).toBe("dtfuv@viavinilo.com");
  });

  it("D-057: un reenvío que es todo el mail no se esconde", () => {
    const body = "________________________________\nDe: Lucía Pérez <lucia.perez@cliente.test>\nAsunto: Pérez Lucía\n\nImpresión en DTF textil";
    const p = parseMailBody(body);
    expect(p.quoted).toBeNull();
    expect(p.text).toContain("Impresión en DTF textil");
  });
});
