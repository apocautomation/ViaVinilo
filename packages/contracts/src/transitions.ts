import { parseAmount } from "./format";
import { z } from "zod";
import { jobStatusSchema, type JobStatus } from "./job-status";

/**
 * Reglas de cambio de estado de una orden (actualización §2.4, D-013, R-JOB-2, R-JOB-3).
 * Las usan la API (para validar) y el tablero (para mostrar solo los botones posibles).
 *
 * - Los pasos de la secuencia del sector son obligatorios: solo se avanza al siguiente.
 * - "Seña recibida" solo aplica a órdenes con seña; si no, se pasa de Cotizado al paso siguiente.
 * - "Archivo con error" se puede marcar mientras el trabajo no está impreso, y vuelve a "Archivo recibido".
 * - Se puede cancelar mientras no esté entregado.
 * - "Alta pendiente" no se mueve desde el tablero: se libera al aprobar el alta (D-014).
 */
export interface TransitionContext {
  /** Secuencia del sector (SectorStage), en orden. */
  sequence: readonly JobStatus[];
  status: JobStatus;
  depositRequired: boolean;
}

export interface AllowedTransitions {
  /** El paso siguiente de la secuencia (el botón grande). */
  next: JobStatus | null;
  /** Otras salidas posibles: error, volver de error, cancelar. */
  other: JobStatus[];
}

const TERMINAL: JobStatus[] = ["DELIVERED", "CANCELLED"];
/** Hasta acá se puede detectar un error en el archivo: después ya está impreso. */
const ERROR_BEFORE: JobStatus = "PRINTED";

function nextInSequence(ctx: TransitionContext): JobStatus | null {
  const steps = ctx.sequence.filter((s) => s !== "DEPOSIT_RECEIVED" || ctx.depositRequired);
  const i = steps.indexOf(ctx.status);
  if (i === -1) return null;
  return steps[i + 1] ?? null;
}

export function allowedTransitions(ctx: TransitionContext): AllowedTransitions {
  const { status, sequence } = ctx;
  if (TERMINAL.includes(status) || status === "PENDING_SIGNUP") {
    return { next: null, other: status === "PENDING_SIGNUP" ? ["CANCELLED"] : [] };
  }
  if (status === "FILE_ERROR") return { next: "RECEIVED", other: ["CANCELLED"] };

  const other: JobStatus[] = [];
  const pos = sequence.indexOf(status);
  const errorLimit = sequence.indexOf(ERROR_BEFORE);
  if (pos !== -1 && (errorLimit === -1 || pos < errorLimit)) other.push("FILE_ERROR");
  other.push("CANCELLED");
  return { next: nextInSequence(ctx), other };
}

export type TransitionCheck =
  | { ok: true; skipsDeposit: boolean }
  | { ok: false; reason: string };

/**
 * ¿Se puede pasar a `to`? `force` solo lo usa el dueño para saltear la seña (R-JOB-3); queda auditado.
 */
export function checkTransition(ctx: TransitionContext, to: JobStatus, force = false): TransitionCheck {
  const allowed = allowedTransitions(ctx);
  if (allowed.next === to || allowed.other.includes(to)) return { ok: true, skipsDeposit: false };

  // R-JOB-3: el dueño puede imprimir sin la seña registrada.
  if (force && ctx.depositRequired && ctx.status !== "DEPOSIT_RECEIVED") {
    const withoutDeposit = nextInSequence({ ...ctx, depositRequired: false });
    if (withoutDeposit === to && allowed.next === "DEPOSIT_RECEIVED") return { ok: true, skipsDeposit: true };
  }

  if (ctx.depositRequired && allowed.next === "DEPOSIT_RECEIVED" && to !== "DEPOSIT_RECEIVED") {
    return { ok: false, reason: "Primero hay que registrar la seña" };
  }
  if (ctx.status === "PENDING_SIGNUP") {
    return { ok: false, reason: "La orden espera que un asesor apruebe el alta del cliente" };
  }
  if (TERMINAL.includes(ctx.status)) return { ok: false, reason: "La orden ya está cerrada" };
  if (to === "FILE_ERROR") return { ok: false, reason: "El trabajo ya está impreso: no se puede marcar error de archivo" };
  return {
    ok: false,
    reason: allowed.next
      ? "Los pasos no se pueden saltear: falta completar el paso anterior"
      : "Ese cambio de estado no está permitido",
  };
}

/** Pedido de cambio de estado desde el tablero. Los datos extra dependen del estado destino. */
export const transitionSchema = z
  .object({
    to: jobStatusSchema,
    /** Obligatorio para "Archivo con error". */
    reasonId: z.string().min(1).optional(),
    /** Obligatoria para cancelar. */
    note: z.string().trim().max(500).optional(),
    /** Obligatorio para "Cotizado" si la orden no tiene precio (R-JOB-2). Pesos con 2 decimales. */
    quotedAmount: z
      .union([z.string(), z.number()])
      // D-055: se escribe "18.500,50"; se guarda "18500.50".
      .transform((v) => parseAmount(v) ?? "")
      .refine((v) => v !== "" && Number(v) > 0, "Ingresá un precio válido")
      .optional(),
    estimatedReadyAt: z.coerce.date().optional(),
    /** Solo el dueño: imprimir sin seña (R-JOB-3). */
    force: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.to === "FILE_ERROR" && !v.reasonId) ctx.addIssue({ code: "custom", path: ["reasonId"], message: "Elegí el motivo del error" });
    if (v.to === "CANCELLED" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Indicá por qué se cancela" });
  });
export type TransitionInput = z.input<typeof transitionSchema>;
