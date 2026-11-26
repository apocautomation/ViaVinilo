import { describe, expect, it } from "vitest";
import { formIntent } from "./order-form";

const fields = (values: Record<string, string>) => (name: string) => values[name] ?? "";

describe("D-079: formulario del panel del pedido", () => {
  it("cotiza con precio, seña y hora estimada en hora de Salta", () => {
    expect(
      formIntent(
        "quote",
        fields({ amount: "20.000", deposit: "5.000", etaDate: "27/11/2026", etaTime: "18:00" }),
        "QUOTED",
      ),
    ).toEqual({
      kind: "move",
      body: {
        to: "QUOTED",
        quotedAmount: "20.000",
        depositAmount: "5.000",
        estimatedReadyAt: "2026-11-27T18:00:00-03:00",
      },
    });
  });
  it("sin seña ni fecha manda la seña en null y no manda la fecha", () => {
    expect(formIntent("quote", fields({ amount: "1000" }), "QUOTED")).toEqual({
      kind: "move",
      body: { to: "QUOTED", quotedAmount: "1000", depositAmount: null },
    });
  });
  it("rechaza una fecha mal escrita", () => {
    expect(formIntent("quote", fields({ amount: "1000", etaDate: "31/02/2026" }), "QUOTED")).toEqual({
      kind: "invalid",
      message: "Escribí la fecha como día/mes/año (por ejemplo 24/11/2026) y la hora en 24 h (18:00).",
    });
  });
  it("rechaza una seña mayor que el precio", () => {
    expect(formIntent("quote", fields({ amount: "1.000", deposit: "2.000" }), "QUOTED")).toEqual({
      kind: "invalid",
      message: "La seña no puede ser mayor que el precio.",
    });
  });
  it("el error de archivo lleva el motivo y la nota si hay", () => {
    expect(formIntent("error", fields({ reason: "r1", note: "borroso" }), "QUOTED")).toEqual({
      kind: "move",
      body: { to: "FILE_ERROR", reasonId: "r1", note: "borroso" },
    });
    expect(formIntent("error", fields({ reason: "r1" }), "QUOTED")).toEqual({
      kind: "move",
      body: { to: "FILE_ERROR", reasonId: "r1", note: undefined },
    });
  });
  it("cancelar manda el motivo", () => {
    expect(formIntent("cancel", fields({ note: "lo pidió el cliente" }), "QUOTED")).toEqual({
      kind: "move",
      body: { to: "CANCELLED", note: "lo pidió el cliente" },
    });
  });
  it("imprimir sin seña pasa directo a Impreso con force", () => {
    expect(formIntent("force", fields({}), "DEPOSIT_RECEIVED")).toEqual({
      kind: "move",
      body: { to: "PRINTED", force: true, note: undefined },
    });
  });
  it("eliminar manda el motivo", () => {
    expect(formIntent("delete", fields({ note: "duplicado" }), null)).toEqual({
      kind: "delete",
      reason: "duplicado",
    });
  });
  it("en modo ver no hay nada que mandar", () => {
    expect(formIntent("view", fields({}), "QUOTED")).toEqual({ kind: "none" });
  });
});
