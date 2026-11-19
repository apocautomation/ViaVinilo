/**
 * Estados de los pedidos de la app de clientes y su forma de mostrarse (D-034).
 * Los estados y su orden salen de la actualización §2.4 y de D-013 (seña).
 */
export type Status = "RECEIVED" | "FILE_ERROR" | "QUOTED" | "DEPOSIT_RECEIVED" | "PRINTED" | "CALENDERING" | "READY" | "DELIVERED";

/** Cómo ve el cliente cada estado. "Impreso", nunca "Imprimiendo" (actualización §2.4). */
export const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: "Archivo recibido",
  FILE_ERROR: "Archivo con error",
  QUOTED: "Cotizado",
  DEPOSIT_RECEIVED: "Seña recibida",
  PRINTED: "Impreso",
  CALENDERING: "En calandra",
  READY: "Listo para retirar",
  DELIVERED: "Entregado",
};

export const STATUS_CLASS: Record<Status, string> = {
  RECEIVED: "st-received",
  FILE_ERROR: "st-error",
  QUOTED: "st-quoted",
  DEPOSIT_RECEIVED: "st-quoted",
  PRINTED: "st-printed",
  CALENDERING: "st-printed",
  READY: "st-ready",
  DELIVERED: "",
};

export interface Order {
  id: string;
  num: string;
  sector: string;
  desc: string;
  measure: string;
  status: Status;
  steps: Status[];
  amount?: number;
  deposit?: number;
  readyAt?: string;
  error?: string;
  files: { name: string; size: string }[];
  history: { status: Status; at: string }[];
  channel: "App" | "Mail";
}

/**
 * Pedidos del cliente. Vacío hasta conectar el seguimiento real con la API (paso 6 del SPEC §10).
 * Se sacaron los pedidos de ejemplo para no mostrar datos inventados en producción.
 */
// TODO(spec): paso 6 — traer los pedidos del cliente desde la API.
export const ORDERS: Order[] = [];

export const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
