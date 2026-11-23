import { describe, expect, it } from "vitest";
import { businessMsBetween, elapsedMs } from "./business-hours";

const HOUR = 3_600_000;
/** Hora de Salta (UTC-3) escrita como se lee en el reloj del local. */
const salta = (iso: string) => new Date(`${iso}:00-03:00`);
const hours = (from: string, to: string) => businessMsBetween(salta(from), salta(to)) / HOUR;

describe("horario de atención (D-073)", () => {
  it("D-073: dentro de un día hábil cuenta las horas tal cual", () => {
    // Lunes 23/11/2026.
    expect(hours("2026-11-23T09:00", "2026-11-23T12:30")).toBe(3.5);
  });

  it("D-073: la noche no cuenta", () => {
    // De lunes 18:00 a martes 10:00: 1 h del lunes + 2 h del martes.
    expect(hours("2026-11-23T18:00", "2026-11-24T10:00")).toBe(3);
    expect(hours("2026-11-23T22:00", "2026-11-24T06:00")).toBe(0);
  });

  it("D-073: el sábado cuenta hasta las 13 y el domingo no cuenta", () => {
    // De sábado 21/11 a las 12:00 a lunes 23/11 a las 09:00: 1 h del sábado + 1 h del lunes.
    expect(hours("2026-11-21T12:00", "2026-11-23T09:00")).toBe(2);
    expect(hours("2026-11-22T10:00", "2026-11-22T18:00")).toBe(0);
  });

  it("D-073: una semana entera son 5 jornadas de 11 h y un sábado de 5 h", () => {
    expect(hours("2026-11-23T00:00", "2026-11-30T00:00")).toBe(60);
  });

  it("D-073: con fechas al revés o iguales da cero; en horas corridas, la diferencia común", () => {
    expect(hours("2026-11-24T10:00", "2026-11-23T10:00")).toBe(0);
    expect(elapsedMs(salta("2026-11-23T18:00"), salta("2026-11-24T10:00"), false) / HOUR).toBe(16);
    expect(elapsedMs(salta("2026-11-23T18:00"), salta("2026-11-24T10:00"), true) / HOUR).toBe(3);
  });
});
