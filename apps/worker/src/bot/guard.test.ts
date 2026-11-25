import { describe, expect, it } from "vitest";
import { dropFiller, dropNoticePromises, fixMailboxes } from "./guard";

describe("controles sobre la respuesta del bot (D-060)", () => {
  it("D-060: corrige casillas mal escritas por el modelo", () => {
    expect(fixMailboxes("Mandalo a látex@viavinilo.com")).toBe("Mandalo a latex@viavinilo.com");
    expect(fixMailboxes("Escribí a GRANFORMATO@viavinilo.com")).toBe("Escribí a granformato@viavinilo.com");
  });

  it("D-060: con los avisos apagados no promete avisar", () => {
    expect(dropNoticePromises("Entre 24 y 48 horas hábiles. Te avisamos por la app cuando está listo.")).toBe("Entre 24 y 48 horas hábiles.");
    expect(dropNoticePromises("Te avisamos.")).toBe("Te avisamos.");
  });

  it("D-104: saca 'Verifico…' al empezar, los ofrecimientos de preparar el archivo y 'el resumen'", () => {
    expect(dropFiller("Verifico... El pedido VV-000112 tiene un problema.")).toBe("El pedido VV-000112 tiene un problema.");
    expect(dropFiller("Mandalo por el clip. ¿Querés que te ayudemos a preparar el archivo?")).toBe("Mandalo por el clip.");
    expect(dropFiller("Está en Archivo recibido. Podés ver el detalle en el resumen. Te pasamos el precio.")).toBe("Está en Archivo recibido. Te pasamos el precio.");
    expect(dropFiller("Lo está revisando el equipo.")).toBe("Lo está revisando el equipo.");
    expect(dropFiller("Se retira en Planta Av. Chile. No se requiere seña.")).toBe("Se retira en Planta Av. Chile.");
    expect(dropFiller("Mandalo por mail. La seña no aplica.")).toBe("Mandalo por mail.");
    expect(dropFiller("Se retira en Planta Av. Chile. No figura en las reglas de seña: no digas que lleva ni que no lleva. Formato: PDF.")).toBe("Se retira en Planta Av. Chile. Formato: PDF.");
    expect(dropFiller("Para empezar falta la seña de $20.000.")).toBe("Para empezar falta la seña de $20.000.");
  });
});
