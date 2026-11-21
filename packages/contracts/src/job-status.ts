import { z } from "zod";
import type { BaseSectorCode } from "./sectors";

/**
 * Estados de una orden de trabajo. Coincide con el enum `JobStatus` de Prisma.
 * Fuente: actualización 17/11 §2.4, D-013 ("Seña recibida") y D-014 ("Alta pendiente") en docs/DESARROLLO.md.
 */
export const JOB_STATUSES = [
  "PENDING_SIGNUP",
  "RECEIVED",
  "FILE_ERROR",
  "QUOTED",
  "DEPOSIT_RECEIVED",
  "PRINTED",
  "CALENDERING",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const;

export const jobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/** Textos que ve el cliente. Nunca "Imprimiendo": el cliente lo lee y sale a buscar el trabajo (actualización §2.4). */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PENDING_SIGNUP: "Alta pendiente",
  RECEIVED: "Archivo recibido",
  FILE_ERROR: "Archivo con error",
  QUOTED: "Cotizado",
  DEPOSIT_RECEIVED: "Seña recibida",
  PRINTED: "Impreso",
  CALENDERING: "En proceso de calandra",
  READY: "Terminado, listo para retirar",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

/**
 * Estados que no forman parte de la secuencia de un sector: se entra y se sale de ellos por
 * caminos propios (alta aprobada, archivo reenviado, cancelación).
 */
export const OFF_SEQUENCE_STATUSES = [
  "PENDING_SIGNUP",
  "FILE_ERROR",
  "CANCELLED",
] as const satisfies readonly JobStatus[];

/**
 * Pasos que solo aplican a algunas órdenes. DEPOSIT_RECEIVED es obligatorio solo si la orden
 * requiere seña (D-013); para clientes que pagan al retirar se pasa de QUOTED a PRINTED.
 */
export const CONDITIONAL_STATUSES = ["DEPOSIT_RECEIVED"] as const satisfies readonly JobStatus[];

const BASE_SEQUENCE = [
  "RECEIVED",
  "QUOTED",
  "DEPOSIT_RECEIVED",
  "PRINTED",
  "READY",
  "DELIVERED",
] as const satisfies readonly JobStatus[];

const CALENDER_SEQUENCE = [
  "RECEIVED",
  "QUOTED",
  "DEPOSIT_RECEIVED",
  "PRINTED",
  "CALENDERING",
  "READY",
  "DELIVERED",
] as const satisfies readonly JobStatus[];

/**
 * Secuencia por defecto de cada sector. Se siembra en `SectorStage` y después es configurable.
 * "En proceso de calandra" solo en Sublimación y Calandrado (actualización §2.4).
 * TODO(spec): I-11 — confirmar con Verónica las capturas de Runamatic por sector.
 */
export const DEFAULT_SECTOR_SEQUENCES: Record<BaseSectorCode, readonly JobStatus[]> = {
  DTF: BASE_SEQUENCE,
  DTF_UV: BASE_SEQUENCE,
  GRAN_FORMATO: BASE_SEQUENCE,
  LATEX: BASE_SEQUENCE,
  CALANDRADO: CALENDER_SEQUENCE,
  SUBLIMACION: CALENDER_SEQUENCE,
};

/** Secuencia de un tablero nuevo (D-064): la común, o con "En proceso de calandra". */
export const sequenceForNewSector = (withCalender: boolean): readonly JobStatus[] => (withCalender ? CALENDER_SEQUENCE : BASE_SEQUENCE);

/** Listado de pedidos del ERP (Ventas → Pedidos). */
export const JOB_LIST_TABS = ["ACTIVE", "READY", "DELIVERED", "ALL"] as const;
export const listJobsSchema = z.object({
  tab: z.enum(JOB_LIST_TABS).default("ACTIVE"),
  sector: z.string().trim().max(40).optional(),
  source: z.enum(["EMAIL", "COUNTER", "API"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListJobsQuery = z.input<typeof listJobsSchema>;
