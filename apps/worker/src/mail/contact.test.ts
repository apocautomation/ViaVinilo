import { describe, expect, it } from "vitest";
import { extractContact, splitName } from "./contact";

describe("datos del remitente en el cuerpo del mail (D-054)", () => {
  it("D-054: lee la ficha típica: nombre, teléfono y lugar de retiro", () => {
    const c = extractContact(
      "Nombre o Número de Cliente: RAMIRO GARNICA\nNombre del Archivo: DARK2\nCel: 0387 15 466-9944\nLugar a retirar: San Juan",
      null,
    );
    expect(c).toEqual({ firstName: "Ramiro", lastName: "Garnica", phone: "+5493874669944", claimedCustomerNumber: null, pickup: "San Juan" });
  });

  it("D-054: un número en lugar del nombre es el N.º de cliente que dice tener", () => {
    expect(extractContact("Nombre o número de cliente: N° 1792", null).claimedCustomerNumber).toBe(1792);
  });

  it("D-054: sin ficha usa el nombre del remitente; un nombre de empresa o un email no se toma como persona", () => {
    expect(extractContact("Hola, va el archivo", "Ana Gómez")).toMatchObject({ firstName: "Ana", lastName: "Gómez" });
    expect(extractContact("Hola", "ventas@remeras.com").firstName).toBeNull();
    expect(extractContact("Hola", "Remeras 2024 SRL").firstName).toBeNull();
  });

  it("D-054: no inventa un teléfono inválido", () => {
    expect(extractContact("Teléfono: 123", null).phone).toBeNull();
  });

  it("D-054: separa nombre y apellido respetando partículas", () => {
    expect(splitName("juan pablo PÉREZ")).toEqual({ firstName: "Juan Pablo", lastName: "Pérez" });
    expect(splitName("María del Valle")).toEqual({ firstName: "María", lastName: "del Valle" });
  });
});
