import { describe, expect, it } from "vitest";
import { SECTOR_CODES } from "@viavinilo/contracts";
import { FILE_ERROR_REASONS, MACHINES, SECTOR_VARIANTS, buildSectors } from "./seed-data";

describe("seed", () => {
  const sectors = buildSectors("ViaVinilo.Test");

  it("siembra los sectores de base; los 6 con casilla la tienen en minúsculas", () => {
    expect(sectors.map((s) => s.code)).toEqual([...SECTOR_CODES]);
    expect(sectors.find((s) => s.code === "DTF")?.inboxEmail).toBe("dtf@viavinilo.test");
    const inboxes = sectors.map((s) => s.inboxEmail).filter(Boolean);
    expect(inboxes).toHaveLength(6);
    expect(new Set(inboxes).size).toBe(6);
  });

  it("D-082: los cinco sistemas de Gran Formato son sub-servicios; TPU es un tablero aparte y nace sin casilla", () => {
    const children = sectors.filter((s) => s.parent === "GRAN_FORMATO").map((s) => s.code);
    expect(children.sort()).toEqual(["CORTES", "ECOSOLVENTE", "LATEX", "UV_RIGIDOS", "UV_ROLLO"]);
    expect(sectors.find((s) => s.code === "TPU")).toMatchObject({ parent: null, inboxEmail: null, name: "TPU" });
    expect(sectors.find((s) => s.code === "DTF")?.name).toBe("DTF Textil");
    expect(sectors.find((s) => s.code === "LATEX")?.inboxEmail).toBe("latex@viavinilo.test");
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

  it("D-108: siembra el catálogo de los Excel de Ricardo, con código único y SKU de Tango", () => {
    expect(SECTOR_VARIANTS.filter((v) => v.sector === "DTF")).toHaveLength(7);
    expect(SECTOR_VARIANTS.filter((v) => v.sector === "CALANDRADO")).toHaveLength(40);
    expect(SECTOR_VARIANTS.find((v) => v.code === "TCLI")).toMatchObject({ name: "Tela del cliente", tangoSku: null });
    expect(new Set(SECTOR_VARIANTS.map((v) => v.code)).size).toBe(SECTOR_VARIANTS.length);
    expect(SECTOR_VARIANTS.find((v) => v.name === "Glitter")).toMatchObject({ sector: "DTF", code: "GLI", tangoSku: "IMDT00009", width: "60", usableWidth: "58" });
  });
});
