import { describe, expect, it } from "vitest";
import { maskAmount, maskCuit, maskDni, parseAmount, parseSaltaDateTime } from "./format";
import { transitionSchema } from "./transitions";

describe("formatos argentinos en los campos (D-055)", () => {
  it("D-055: el CUIT se escribe con guiones", () => {
    expect(maskCuit("324234234")).toBe("32-4234234");
    expect(maskCuit("20123456789")).toBe("20-12345678-9");
    expect(maskCuit("20-12345678-9")).toBe("20-12345678-9");
    expect(maskCuit("201234567890000")).toBe("20-12345678-9");
    expect(maskCuit("2")).toBe("2");
  });

  it("D-055: el DNI se escribe con puntos", () => {
    expect(maskDni("30111222")).toBe("30.111.222");
    expect(maskDni("30.111.22")).toBe("3.011.122");
  });

  it("D-055: los montos se escriben con puntos de miles y coma decimal", () => {
    expect(maskAmount("18500")).toBe("18.500");
    expect(maskAmount("1234567,5")).toBe("1.234.567,5");
    expect(maskAmount("18.500,509")).toBe("18.500,50");
    expect(maskAmount("18500.")).toBe("18.500,");
    expect(maskAmount(",5")).toBe("0,5");
    expect(maskAmount("$ 007")).toBe("7");
  });

  it("D-055: el monto se guarda con punto decimal, se escriba como se escriba", () => {
    expect(parseAmount("18.500,50")).toBe("18500.50");
    expect(parseAmount("18500,5")).toBe("18500.50");
    expect(parseAmount("18.500")).toBe("18500.00");
    expect(parseAmount("18500.5")).toBe("18500.50");
    expect(parseAmount(18500.5)).toBe("18500.50");
    expect(parseAmount("abc")).toBeNull();
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "1.234.567,89" }).quotedAmount).toBe("1234567.89");
  });

  it("D-079: la fecha se escribe día/mes/año y en 24 h, y se guarda con la hora de Salta", () => {
    expect(parseSaltaDateTime("24/11/2026", "18:00")).toBe("2026-11-24T18:00:00-03:00");
    expect(parseSaltaDateTime("5/1/27", "9")).toBe("2027-01-05T09:00:00-03:00");
    // Sin hora: cierre del día.
    expect(parseSaltaDateTime("24/11/2026")).toBe("2026-11-24T18:00:00-03:00");
    // Mes/día (como lo mostraba el navegador) no es una fecha válida: no se adivina.
    expect(parseSaltaDateTime("11/24/2026", "18:00")).toBeNull();
    expect(parseSaltaDateTime("31/02/2026", "10:00")).toBeNull();
    expect(parseSaltaDateTime("24/11/2026", "25:00")).toBeNull();
    expect(parseSaltaDateTime("mañana")).toBeNull();
  });

  it("D-079: la seña al cotizar acepta un monto, vacío o null", () => {
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "20.000", depositAmount: "10.000" }).depositAmount).toBe("10000.00");
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "20.000", depositAmount: "" }).depositAmount).toBeNull();
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "20.000", depositAmount: null }).depositAmount).toBeNull();
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "20.000" }).depositAmount).toBeUndefined();
    expect(transitionSchema.safeParse({ to: "QUOTED", quotedAmount: "20.000", depositAmount: "abc" }).success).toBe(false);
  });
});
