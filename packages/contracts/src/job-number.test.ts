import { describe, expect, it } from "vitest";
import { formatJobNumber, parseJobNumber } from "./job-number";

describe("número de orden", () => {
  it("R-JOB-1: formatea el correlativo como VV-000123", () => {
    expect(formatJobNumber(123)).toBe("VV-000123");
    expect(formatJobNumber(1)).toBe("VV-000001");
  });

  it("R-JOB-1: no trunca números de más de 6 dígitos", () => {
    expect(formatJobNumber(1234567)).toBe("VV-1234567");
  });

  it("R-JOB-1: rechaza números no correlativos válidos", () => {
    expect(() => formatJobNumber(0)).toThrow(RangeError);
    expect(() => formatJobNumber(1.5)).toThrow(RangeError);
  });

  it("R-JOB-1: el formateo y el parseo son inversos", () => {
    for (const n of [1, 42, 999999, 1000000]) {
      expect(parseJobNumber(formatJobNumber(n))).toBe(n);
    }
  });

  it("acepta minúsculas y espacios al buscar", () => {
    expect(parseJobNumber("  vv-000123 ")).toBe(123);
  });

  it("devuelve null para textos que no son un número de orden", () => {
    expect(parseJobNumber("123")).toBeNull();
    expect(parseJobNumber("VV-12")).toBeNull();
    expect(parseJobNumber("VV-000000")).toBeNull();
  });
});
