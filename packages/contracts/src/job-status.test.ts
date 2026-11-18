import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTOR_SEQUENCES,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  OFF_SEQUENCE_STATUSES,
} from "./job-status";
import { SECTOR_CODES } from "./sectors";

describe("estados de la orden", () => {
  it("todos los estados tienen texto para el cliente y ninguno dice 'imprimiendo'", () => {
    for (const status of JOB_STATUSES) {
      const label = JOB_STATUS_LABELS[status];
      expect(label.length).toBeGreaterThan(0);
      expect(label.toLowerCase()).not.toContain("imprimiendo");
    }
  });

  it("cada sector tiene secuencia, empieza en RECEIVED y termina en DELIVERED", () => {
    for (const code of SECTOR_CODES) {
      const seq = DEFAULT_SECTOR_SEQUENCES[code];
      expect(seq[0]).toBe("RECEIVED");
      expect(seq.at(-1)).toBe("DELIVERED");
      expect(new Set(seq).size).toBe(seq.length);
    }
  });

  it("las secuencias no incluyen estados fuera de secuencia", () => {
    for (const code of SECTOR_CODES) {
      for (const status of OFF_SEQUENCE_STATUSES) {
        expect(DEFAULT_SECTOR_SEQUENCES[code]).not.toContain(status);
      }
    }
  });

  it("D-013: Seña recibida va después de Cotizado y antes de Impreso en todos los sectores", () => {
    for (const code of SECTOR_CODES) {
      const seq = DEFAULT_SECTOR_SEQUENCES[code];
      const quoted = seq.indexOf("QUOTED");
      const deposit = seq.indexOf("DEPOSIT_RECEIVED");
      const printed = seq.indexOf("PRINTED");
      expect(quoted).toBeGreaterThanOrEqual(0);
      expect(deposit).toBe(quoted + 1);
      expect(printed).toBe(deposit + 1);
    }
  });

  it("la calandra solo existe en Sublimación y Calandrado, después de Impreso", () => {
    for (const code of SECTOR_CODES) {
      const seq = DEFAULT_SECTOR_SEQUENCES[code];
      const hasCalender = seq.includes("CALENDERING");
      expect(hasCalender).toBe(code === "SUBLIMACION" || code === "CALANDRADO");
      if (hasCalender) {
        expect(seq.indexOf("CALENDERING")).toBe(seq.indexOf("PRINTED") + 1);
      }
    }
  });
});
