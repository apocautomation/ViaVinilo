import { describe, expect, it } from "vitest";
import { DEFAULT_SECTOR_SEQUENCES } from "./job-status";
import { allowedTransitions, checkTransition, transitionSchema } from "./transitions";

const dtf = DEFAULT_SECTOR_SEQUENCES.DTF;
const subli = DEFAULT_SECTOR_SEQUENCES.SUBLIMACION;

describe("transiciones de estado", () => {
  it("actualización §2.4: se avanza de a un paso y no se puede saltear", () => {
    const ctx = { sequence: dtf, status: "RECEIVED" as const, depositRequired: false };
    expect(allowedTransitions(ctx).next).toBe("QUOTED");
    const skip = checkTransition(ctx, "PRINTED");
    expect(skip).toEqual({ ok: false, reason: "Los pasos no se pueden saltear: falta completar el paso anterior" });
  });

  it("D-013: sin seña requerida se pasa de Cotizado a Impreso", () => {
    expect(allowedTransitions({ sequence: dtf, status: "QUOTED", depositRequired: false }).next).toBe("PRINTED");
    expect(checkTransition({ sequence: dtf, status: "QUOTED", depositRequired: false }, "DEPOSIT_RECEIVED").ok).toBe(false);
  });

  it("R-JOB-3: con seña requerida no se puede pasar a Impreso sin 'Seña recibida'", () => {
    const ctx = { sequence: dtf, status: "QUOTED" as const, depositRequired: true };
    expect(allowedTransitions(ctx).next).toBe("DEPOSIT_RECEIVED");
    expect(checkTransition(ctx, "PRINTED")).toEqual({ ok: false, reason: "Primero hay que registrar la seña" });
    expect(checkTransition({ ...ctx, status: "DEPOSIT_RECEIVED" }, "PRINTED").ok).toBe(true);
  });

  it("R-JOB-3: el dueño puede forzar la impresión sin seña", () => {
    const ctx = { sequence: dtf, status: "QUOTED" as const, depositRequired: true };
    expect(checkTransition(ctx, "PRINTED", true)).toEqual({ ok: true, skipsDeposit: true });
    // Forzar no sirve para saltear otros pasos.
    expect(checkTransition({ ...ctx, status: "RECEIVED" }, "PRINTED", true).ok).toBe(false);
  });

  it("Sublimación pasa por calandra después de Impreso", () => {
    expect(allowedTransitions({ sequence: subli, status: "PRINTED", depositRequired: false }).next).toBe("CALENDERING");
    expect(allowedTransitions({ sequence: dtf, status: "PRINTED", depositRequired: false }).next).toBe("READY");
  });

  it("el error de archivo se marca antes de imprimir y vuelve a 'Archivo recibido'", () => {
    expect(allowedTransitions({ sequence: dtf, status: "QUOTED", depositRequired: false }).other).toContain("FILE_ERROR");
    expect(allowedTransitions({ sequence: dtf, status: "PRINTED", depositRequired: false }).other).not.toContain("FILE_ERROR");
    expect(allowedTransitions({ sequence: dtf, status: "FILE_ERROR", depositRequired: false })).toEqual({
      next: "RECEIVED",
      other: ["CANCELLED"],
    });
  });

  it("entregado y cancelado son finales; alta pendiente solo se puede cancelar", () => {
    expect(allowedTransitions({ sequence: dtf, status: "DELIVERED", depositRequired: false })).toEqual({ next: null, other: [] });
    expect(allowedTransitions({ sequence: dtf, status: "CANCELLED", depositRequired: false })).toEqual({ next: null, other: [] });
    expect(allowedTransitions({ sequence: dtf, status: "PENDING_SIGNUP", depositRequired: false })).toEqual({
      next: null,
      other: ["CANCELLED"],
    });
  });

  it("el pedido exige motivo para el error y nota para cancelar; el precio acepta coma", () => {
    expect(transitionSchema.safeParse({ to: "FILE_ERROR" }).success).toBe(false);
    expect(transitionSchema.safeParse({ to: "CANCELLED" }).success).toBe(false);
    expect(transitionSchema.parse({ to: "QUOTED", quotedAmount: "15000,50" }).quotedAmount).toBe("15000.50");
    expect(transitionSchema.safeParse({ to: "QUOTED", quotedAmount: "-3" }).success).toBe(false);
  });
});
