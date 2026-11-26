import { parseAmount, parseSaltaDateTime, type JobStatus, type TransitionInput } from "@viavinilo/contracts";
import type { PanelMode } from "./board-rules";

/** Lo que pide el formulario del panel del pedido al confirmar (D-079). */
export type FormIntent =
  | { kind: "none" }
  | { kind: "invalid"; message: string }
  | { kind: "move"; body: TransitionInput }
  | { kind: "delete"; reason: string };

/** Lee un campo del formulario ya recortado; vacío si no está. */
export type FieldReader = (name: string) => string;

/** Fecha estimada en hora de Salta; undefined si no se escribió, null si está mal escrita. */
function readEta(text: FieldReader): string | null | undefined {
  const date = text("etaDate");
  return date ? parseSaltaDateTime(date, text("etaTime")) : undefined;
}

function depositTooHigh(amount: string, deposit: string): boolean {
  const price = parseAmount(amount);
  return !!deposit && !!price && Number(parseAmount(deposit) ?? 0) > Number(price);
}

function quoteIntent(text: FieldReader): FormIntent {
  const eta = readEta(text);
  if (eta === null)
    return {
      kind: "invalid",
      message: "Escribí la fecha como día/mes/año (por ejemplo 24/11/2026) y la hora en 24 h (18:00).",
    };
  const deposit = text("deposit");
  if (depositTooHigh(text("amount"), deposit))
    return { kind: "invalid", message: "La seña no puede ser mayor que el precio." };
  return {
    kind: "move",
    body: {
      to: "QUOTED",
      quotedAmount: text("amount"),
      depositAmount: deposit || null,
      ...(eta ? { estimatedReadyAt: eta } : {}),
    },
  };
}

const optionalNote = (text: FieldReader) => text("note") || undefined;

const INTENTS: Record<PanelMode, (text: FieldReader, next: JobStatus | null) => FormIntent> = {
  quote: quoteIntent,
  error: (text) => ({
    kind: "move",
    body: { to: "FILE_ERROR", reasonId: text("reason"), note: optionalNote(text) },
  }),
  cancel: (text) => ({ kind: "move", body: { to: "CANCELLED", note: text("note") } }),
  // Imprimir sin seña saltea "Seña recibida"; sin paso siguiente no hay a dónde forzar.
  force: (text, next) =>
    next
      ? {
          kind: "move",
          body: { to: next === "DEPOSIT_RECEIVED" ? "PRINTED" : next, force: true, note: optionalNote(text) },
        }
      : { kind: "none" },
  // D-088: al eliminar no queda pedido que mostrar.
  delete: (text) => ({ kind: "delete", reason: text("note") }),
  view: () => ({ kind: "none" }),
};

/** Traduce el formulario de cada modo al pedido a la API. `next` es el paso siguiente del pedido. */
export function formIntent(mode: PanelMode, text: FieldReader, next: JobStatus | null): FormIntent {
  return INTENTS[mode](text, next);
}
