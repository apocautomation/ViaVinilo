import { describe, expect, it } from "vitest";
import { dropFiller, dropNoticePromises, ensureMapLinks, fixMailboxes, plainText } from "./guard";

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

  it("D-106: las sucursales nombradas van con su link del mapa; los links en markdown pasan a texto", () => {
    expect(ensureMapLinks("La Sucursal Centro está en San Juan 714, Salta. Si querés el mapa, mandame el link.")).toBe(
      "La Sucursal Centro está en San Juan 714, Salta.\n\nMapa:\nSucursal Centro: https://maps.google.com/?q=San+Juan+714,+Salta",
    );
    const both = "Planta Av. Chile: https://shortest.link/Gpsviavinilo y Sucursal Centro: https://maps.google.com/?q=San+Juan+714,+Salta";
    expect(ensureMapLinks(both)).toBe(both);
    expect(plainText("Mapa: [Planta Av. Chile](https://shortest.link/Gpsviavinilo)")).toBe("Mapa: Planta Av. Chile: https://shortest.link/Gpsviavinilo");
    expect(plainText("Podés verlo acá: https://shortest.link/Gpsviavinilo.")).toBe("Podés verlo acá: https://shortest.link/Gpsviavinilo");
  });

  it("D-106: no ofrece decir el precio", () => {
    expect(dropFiller("Recibimos el archivo y te pasamos el precio. ¿Querés saber cuánto sale?")).toBe("Recibimos el archivo y te pasamos el precio.");
  });

  it("D-107: con el archivo en revisión no sugiere mandarlo de nuevo 'para verlo'", () => {
    expect(dropFiller("El archivo del pedido VV-000104 lo está revisando el equipo. Si tenés dudas o querés ver el archivo, mandá el clip 📎 de este chat eligiendo ese pedido.")).toBe(
      "El archivo del pedido VV-000104 lo está revisando el equipo.",
    );
  });
});
