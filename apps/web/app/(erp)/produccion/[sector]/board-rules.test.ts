import { describe, expect, it } from "vitest";
import type { BoardColumn } from "@viavinilo/contracts";
import {
  ageLabel,
  boardQuery,
  dropIntent,
  dropVerdict,
  flowOf,
  isLate,
  nextIntent,
  waitingDeposit,
} from "./board-rules";

const card = (over: Partial<Parameters<typeof dropIntent>[0]> = {}) => ({
  status: "RECEIVED" as const,
  next: "QUOTED" as const,
  other: ["FILE_ERROR", "CANCELLED"] as const,
  quotedAmount: null,
  ...over,
});

describe("botón de avance del tablero", () => {
  it("sin paso siguiente no hace nada", () => {
    expect(nextIntent(card({ next: null }))).toEqual({ kind: "none" });
  });
  it("para cotizar sin precio abre el panel en modo cotizar", () => {
    expect(nextIntent(card())).toEqual({ kind: "panel", mode: "quote" });
  });
  it("con precio cargado avanza directo", () => {
    expect(nextIntent(card({ quotedAmount: "1000.00" }))).toEqual({ kind: "move", to: "QUOTED" });
    expect(nextIntent(card({ status: "QUOTED", next: "PRINTED" }))).toEqual({ kind: "move", to: "PRINTED" });
  });
});

describe("D-086: soltar una tarjeta en una columna", () => {
  it("en su misma columna no hace nada", () => {
    expect(dropIntent(card(), "RECEIVED", false)).toEqual({ kind: "none" });
  });
  it("en la columna siguiente vale lo mismo que el botón", () => {
    expect(dropIntent(card(), "QUOTED", false)).toEqual({ kind: "panel", mode: "quote" });
    expect(dropIntent(card({ quotedAmount: "10" }), "QUOTED", false)).toEqual({ kind: "move", to: "QUOTED" });
  });
  it("en Archivo con error pide el motivo", () => {
    expect(dropIntent(card(), "FILE_ERROR", false)).toEqual({ kind: "panel", mode: "error" });
  });
  it("en Impreso sin seña: el dueño lo autoriza, el resto recibe un aviso", () => {
    const waiting = card({ status: "QUOTED", next: "DEPOSIT_RECEIVED", other: [] });
    expect(dropIntent(waiting, "PRINTED", true)).toEqual({ kind: "panel", mode: "force" });
    expect(dropIntent(waiting, "PRINTED", false)).toEqual({
      kind: "toast",
      message: "Primero hay que registrar la seña.",
    });
  });
  it("no deja saltear pasos", () => {
    expect(dropIntent(card(), "READY", true)).toEqual({
      kind: "toast",
      message: "Los pasos no se pueden saltear: el pedido avanza de a un paso.",
    });
  });
  it("marca la columna como válida solo para el paso siguiente o el error de archivo", () => {
    expect(dropVerdict(card(), "QUOTED", false)).toBe("ok");
    expect(dropVerdict(card(), "FILE_ERROR", false)).toBe("ok");
    expect(dropVerdict(card(), "READY", true)).toBe("no");
    expect(dropVerdict(card({ other: [] }), "FILE_ERROR", false)).toBe("no");
    const waiting = card({ status: "QUOTED", next: "DEPOSIT_RECEIVED", other: [] });
    expect(dropVerdict(waiting, "PRINTED", true)).toBe("ok");
    expect(dropVerdict(waiting, "PRINTED", false)).toBe("no");
  });
});

describe("filtros del tablero", () => {
  it("arma la consulta solo con los filtros puestos", () => {
    expect(
      boardQuery({ sector: "DTF", q: "  ", machineId: "", service: "", variant: "", groupByMaterial: false }),
    ).toBe("sector=DTF");
    expect(
      boardQuery({
        sector: "DTF",
        q: " vv-12 ",
        machineId: "m1",
        service: "LATEX",
        variant: "v1",
        groupByMaterial: true,
      }),
    ).toBe("sector=DTF&q=vv-12&machineId=m1&service=LATEX&variant=v1&groupByMaterial=true");
  });
});

describe("tiempo en el paso", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  it("muestra minutos, horas o días", () => {
    expect(ageLabel(ago(5), now)).toBe("5 min");
    expect(ageLabel(ago(135), now)).toBe("2 h 15 min");
    expect(ageLabel(ago(60 * 50), now)).toBe("2 d");
  });
  it("una hora del futuro cuenta como cero", () => {
    expect(ageLabel(ago(-10), now)).toBe("0 min");
  });
  it("más de 2 h en el mismo paso se marca", () => {
    expect(isLate(ago(120), now)).toBe(false);
    expect(isLate(ago(121), now)).toBe(true);
  });
});

describe("seña y pasos", () => {
  it("espera seña solo si la pide, no está paga y es el paso siguiente", () => {
    const base = { depositRequired: true, depositPaidAt: null, next: "DEPOSIT_RECEIVED" as const };
    expect(waitingDeposit(base)).toBe(true);
    expect(waitingDeposit({ ...base, depositPaidAt: "2026-11-27T10:00:00Z" })).toBe(false);
    expect(waitingDeposit({ ...base, depositRequired: false })).toBe(false);
    expect(waitingDeposit({ ...base, next: "PRINTED" })).toBe(false);
  });
  it("la secuencia deja afuera el error de archivo, el alta pendiente y la columna de seña", () => {
    const col = (key: string, status: BoardColumn["status"]): BoardColumn => ({
      key,
      status,
      label: key,
      cards: [],
    });
    const flow = flowOf([
      col("PENDING_SIGNUP", "PENDING_SIGNUP"),
      col("RECEIVED", "RECEIVED"),
      col("FILE_ERROR", "FILE_ERROR"),
      col("QUOTED", "QUOTED"),
      col("AWAITING_DEPOSIT", "QUOTED"),
      col("PRINTED", "PRINTED"),
    ]);
    expect(flow).toEqual(["RECEIVED", "QUOTED", "PRINTED"]);
  });
});
