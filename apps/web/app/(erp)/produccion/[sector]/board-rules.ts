import type { BoardCard, BoardColumn, FileCheckSummary, JobStatus } from "@viavinilo/contracts";

/** Qué se abre del panel del pedido (D-079). */
export type PanelMode = "view" | "quote" | "error" | "cancel" | "force" | "delete";

/** Lo que hace el tablero después de un clic o de soltar una tarjeta. */
export type BoardIntent =
  | { kind: "none" }
  | { kind: "move"; to: JobStatus }
  | { kind: "panel"; mode: PanelMode }
  | { kind: "toast"; message: string };

type Movable = Pick<BoardCard, "status" | "next" | "quotedAmount"> & { other: readonly JobStatus[] };

/** Texto del botón grande para pasar a cada estado: un clic, sin pensar. */
const NEXT_ACTION: Partial<Record<JobStatus, string>> = {
  RECEIVED: "Archivo corregido",
  QUOTED: "Cotizar",
  DEPOSIT_RECEIVED: "Registrar seña",
  PRINTED: "Marcar impreso",
  CALENDERING: "Pasar a calandra",
  READY: "Marcar terminado",
  DELIVERED: "Entregar",
};

export const nextActionLabel = (next: JobStatus) => NEXT_ACTION[next] ?? "Avanzar";

/** Título del control del archivo (D-065). */
export const FILE_CHECK_TITLE: Record<FileCheckSummary["verdict"], string> = {
  ok: "Archivo controlado",
  review: "Revisar el archivo",
  error: "Archivo con problema",
  unknown: "No se pudo controlar solo",
};

/** El botón de avance: para cotizar sin precio se abre el panel; si no, se pasa al paso siguiente. */
export function nextIntent(card: Pick<Movable, "next" | "quotedAmount">): BoardIntent {
  if (!card.next) return { kind: "none" };
  if (card.next === "QUOTED" && !card.quotedAmount) return { kind: "panel", mode: "quote" };
  return { kind: "move", to: card.next };
}

/**
 * Soltar una tarjeta en una columna (D-086). Vale lo mismo que el botón: solo al paso que sigue, a
 * "Archivo con error" (pide el motivo) o, para el dueño, a "Impreso" sin seña. No se saltean pasos.
 */
export function dropIntent(card: Movable, target: JobStatus, isOwner: boolean): BoardIntent {
  if (card.status === target) return { kind: "none" };
  if (target === card.next) return nextIntent(card);
  if (target === "FILE_ERROR" && card.other.includes("FILE_ERROR")) return { kind: "panel", mode: "error" };
  if (target === "PRINTED" && card.next === "DEPOSIT_RECEIVED") {
    return isOwner
      ? { kind: "panel", mode: "force" }
      : { kind: "toast", message: "Primero hay que registrar la seña." };
  }
  return { kind: "toast", message: "Los pasos no se pueden saltear: el pedido avanza de a un paso." };
}

/** Cómo se pinta la columna mientras se arrastra una tarjeta encima: la misma regla que al soltarla. */
export function dropVerdict(card: Movable, target: JobStatus, isOwner: boolean): "ok" | "no" {
  const { kind } = dropIntent(card, target, isOwner);
  return kind === "move" || kind === "panel" ? "ok" : "no";
}

/** Un pedido entregado o cancelado ya no se reasigna ni cambia de retiro. */
export const isOpenJob = (job: Pick<BoardCard, "status">) =>
  job.status !== "DELIVERED" && job.status !== "CANCELLED";

export interface BoardFilters {
  sector: string;
  q: string;
  machineId: string;
  service: string;
  variant: string;
  groupByMaterial: boolean;
}

/** Consulta de `GET /jobs/board` con los filtros que estén puestos. */
export function boardQuery(f: BoardFilters): string {
  const p = new URLSearchParams({ sector: f.sector });
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.machineId) p.set("machineId", f.machineId);
  if (f.service) p.set("service", f.service);
  if (f.variant) p.set("variant", f.variant);
  if (f.groupByMaterial) p.set("groupByMaterial", "true");
  return p.toString();
}

/** Más de 2 h en el mismo paso: se marca en amarillo. TODO(spec): I-11 — umbral por sector. */
const LATE_MIN = 120;

const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));

export const isLate = (iso: string, now: number) => minutesSince(iso, now) > LATE_MIN;

export function ageLabel(iso: string, now: number): string {
  const min = minutesSince(iso, now);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d`;
}

export const waitingDeposit = (card: Pick<BoardCard, "depositRequired" | "depositPaidAt" | "next">) =>
  card.depositRequired && !card.depositPaidAt && card.next === "DEPOSIT_RECEIVED";

/** Los pasos de la secuencia del tablero, sin el error de archivo, el alta pendiente ni la columna "Esperando seña". */
export function flowOf(columns: readonly BoardColumn[]): JobStatus[] {
  return columns
    .filter((c) => c.status !== "FILE_ERROR" && c.status !== "PENDING_SIGNUP" && c.key === c.status)
    .map((c) => c.status);
}
