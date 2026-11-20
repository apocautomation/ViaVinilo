import { describe, expect, it } from "vitest";
import { mapRunamaticRow, mapTaxCondition, parseCsv } from "./runamatic-map";

const HEADER =
  "Nombre completo,Teléfono,Email,Etiquetas,Último pedido,Última reserva,Último documento,Último presupuesto,Origen del chat,Título del anuncio,Texto del anuncio,Plataforma del anuncio,ID del anuncio,Enlace del anuncio,Respuesta IA,CUIT o CUIL,Condición ante IVA,domicilio,Tipo de servicio,DNI";

/** Una fila ya separada en campos, como la devuelve parseCsv. */
const row = (fields: Record<string, string>) => HEADER.split(",").map((c) => fields[c] ?? "");

describe("importación de clientes de Runamatic (D-049)", () => {
  const header = HEADER.split(",");

  it("D-049: separa nombre y apellido, normaliza teléfono, email, CUIT y condición frente al IVA", () => {
    const c = mapRunamaticRow(
      header,
      row({
        "Nombre completo": "  María   José López ",
        Teléfono: "5493874669944",
        Email: " Maria@Estampados.TEST ",
        "CUIT o CUIL": "30-50001091-2",
        "Condición ante IVA": "monotributista",
        domicilio: "Av. Belgrano 100, Salta",
        "Origen del chat": "WhatsApp",
        Etiquetas: "Cliente Registrado",
      }),
      "20/11/2026",
    );
    expect(c).toMatchObject({
      firstName: "María",
      lastName: "José López",
      phone: "+5493874669944",
      email: "maria@estampados.test",
      cuit: "30500010912",
      taxCondition: "MONOTRIBUTO",
      fiscalAddress: "Av. Belgrano 100, Salta",
      dni: null,
      warnings: [],
    });
    expect(c.internalNotes).toContain("Importado de Runamatic el 20/11/2026");
    expect(c.internalNotes).toContain("Origen: WhatsApp");
  });

  it("D-049: un contacto sin email igual se importa, y los datos que no sirven quedan para revisar", () => {
    const c = mapRunamaticRow(
      header,
      row({ "Nombre completo": "Kiosco", Teléfono: "5493871112233", "CUIT o CUIL": "20-11111111-1", "Condición ante IVA": "No inscripto" }),
      "20/11/2026",
    );
    expect(c.email).toBeNull();
    expect(c.lastName).toBeNull();
    expect(c.cuit).toBeNull();
    expect(c.taxCondition).toBeNull();
    expect(c.warnings).toEqual(["CUIT no válido: 20-11111111-1", 'condición IVA "No inscripto"']);
    expect(c.internalNotes).toContain("Revisar:");
  });

  it("D-049: lee el CSV con comillas, comas y saltos de línea dentro de un campo", () => {
    const rows = parseCsv(`\uFEFF${HEADER}\r\n"Pérez, Juan",549387,,,,,,,WhatsApp,,,,,,"línea 1\nlínea 2",,,,,\r\n`);
    expect(rows).toHaveLength(2);
    expect(rows[1]![0]).toBe("Pérez, Juan");
    expect(rows[1]![14]).toBe("línea 1\nlínea 2");
  });

  it("D-049: las condiciones frente al IVA escritas a mano se reconocen", () => {
    expect(mapTaxCondition("CONSUMIDOR FINAL")).toBe("CONSUMIDOR_FINAL");
    expect(mapTaxCondition("Responsable inscripto")).toBe("RESPONSABLE_INSCRIPTO");
    expect(mapTaxCondition("Monotributo")).toBe("MONOTRIBUTO");
    expect(mapTaxCondition("exenta")).toBe("EXENTO");
    expect(mapTaxCondition("")).toBeNull();
  });
});
