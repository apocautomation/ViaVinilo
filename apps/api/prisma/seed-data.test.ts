import { describe, expect, it } from "vitest";
import { SECTOR_CODES } from "@viavinilo/contracts";
import { FILE_ERROR_REASONS, MACHINES, buildSectors } from "./seed-data";

describe("seed", () => {
  const sectors = buildSectors("ViaVinilo.Test");

  it("siembra los 6 sectores con su casilla en minúsculas", () => {
    expect(sectors.map((s) => s.code)).toEqual([...SECTOR_CODES]);
    expect(sectors.find((s) => s.code === "DTF")?.inboxEmail).toBe("dtf@viavinilo.test");
    expect(new Set(sectors.map((s) => s.inboxEmail)).size).toBe(6);
  });

  it("las posiciones de cada secuencia son 1..n sin huecos", () => {
    for (const s of sectors) {
      expect(s.stages.map((st) => st.position)).toEqual(s.stages.map((_, i) => i + 1));
    }
  });

  it("siembra las 16 máquinas del SPEC, con nombre único y al menos un sector", () => {
    expect(MACHINES).toHaveLength(16);
    expect(new Set(MACHINES.map((m) => m.name)).size).toBe(16);
    for (const m of MACHINES) expect(m.sectors.length).toBeGreaterThan(0);
  });

  it("todos los sectores tienen al menos una máquina", () => {
    for (const code of SECTOR_CODES) {
      expect(MACHINES.some((m) => m.sectors.includes(code))).toBe(true);
    }
  });

  it("los motivos de error tienen código único", () => {
    expect(new Set(FILE_ERROR_REASONS.map((r) => r.code)).size).toBe(FILE_ERROR_REASONS.length);
  });
});
