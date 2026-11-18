import { describe, expect, it } from "vitest";
import { customerSearchText, normalizeEmail, normalizePhone, normalizeSearch } from "./contact";

describe("búsqueda", () => {
  it("ignora tildes, mayúsculas y espacios de más", () => {
    expect(normalizeSearch("  José   NÚÑEZ ")).toBe("jose nunez");
    expect(customerSearchText({ firstName: "María", lastName: "López" })).toBe("maria lopez");
    expect(customerSearchText({ firstName: null, lastName: null })).toBe("");
  });
});
import { createCustomerSchema, missingFieldsForApproval } from "./customers";

describe("normalización de contacto", () => {
  it("el email se guarda en minúsculas y sin espacios", () => {
    expect(normalizeEmail("  Juan.Perez@Gmail.COM ")).toBe("juan.perez@gmail.com");
  });

  it("I-12: el mismo celular de Salta escrito de distintas formas da el mismo +549…", () => {
    for (const input of [
      "387 466-9944",
      "3874669944",
      "0387 15 466-9944",
      "387 15 466-9944",
      "+54 9 387 466-9944",
      "+54 387 466-9944",
    ]) {
      expect(normalizePhone(input)).toBe("+5493874669944");
    }
  });

  it("un número de otro país no se toca", () => {
    expect(normalizePhone("+34 612 345 678")).toBe("+34612345678");
  });

  it("un teléfono inválido devuelve null", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("hola")).toBeNull();
  });
});

describe("alta de cliente", () => {
  const valid = {
    firstName: "Juan",
    lastName: "Pérez",
    dni: "30.123.456",
    emails: ["Juan@Example.com"],
    phones: ["387 466-9944"],
  };

  it("normaliza DNI, emails y teléfonos", () => {
    const parsed = createCustomerSchema.parse(valid);
    expect(parsed.dni).toBe("30123456");
    expect(parsed.emails).toEqual(["juan@example.com"]);
    expect(parsed.phones).toEqual(["+5493874669944"]);
  });

  it("actualización §2.1: exige nombre, apellido, DNI, email y teléfono", () => {
    expect(createCustomerSchema.safeParse({ ...valid, emails: [] }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ ...valid, phones: [] }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ ...valid, dni: "12" }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ ...valid, firstName: " " }).success).toBe(false);
  });

  it("actualización §2.1: indica qué falta para aprobar un alta pendiente", () => {
    expect(
      missingFieldsForApproval({ firstName: null, lastName: "Pérez", dni: null, emailCount: 1, phoneCount: 0 }),
    ).toEqual(["nombre", "DNI", "teléfono"]);
    expect(
      missingFieldsForApproval({ firstName: "Juan", lastName: "Pérez", dni: "30123456", emailCount: 1, phoneCount: 1 }),
    ).toEqual([]);
  });
});
