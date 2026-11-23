/**
 * Estados de los pedidos de la app de clientes y su forma de mostrarse (D-034).
 * Los estados y su orden salen de la actualización §2.4 y de D-013 (seña).
 */
export type Status = "RECEIVED" | "FILE_ERROR" | "QUOTED" | "DEPOSIT_RECEIVED" | "PRINTED" | "CALENDERING" | "READY" | "DELIVERED" | "CANCELLED";

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
  CANCELLED: "Cancelado",
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
  CANCELLED: "",
};

/** Un pedido como lo manda la API (`GET /app/jobs`): sale directo del tablero de producción. */
export interface Order {
  /** Número del pedido, sin formato: es lo que va en la dirección `/pedidos/418`. */
  id: string;
  num: string;
  sector: string;
  desc: string;
  measure: string;
  status: Status;
  steps: Status[];
  amount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  depositPaid: boolean;
  readyAt: string | null;
  /** El cliente todavía puede cancelarlo desde la app (hasta "Cotizado"). */
  canCancel: boolean;
  error: string | null;
  files: { name: string; size: string; available: boolean }[];
  history: { status: Status; at: string }[];
  channel: "App" | "Mail" | "Mostrador";
  createdAt: string;
}

const SALTA = "America/Argentina/Salta";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: SALTA });
const hour = new Intl.DateTimeFormat("es-AR", { timeZone: SALTA, hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("es-AR", { timeZone: SALTA, day: "2-digit", month: "2-digit" });

/** "Hoy 12:20", "Ayer 09:15", "Mañana 10:00" o "18/11 16:30", siempre en hora de Salta. */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const key = (x: Date) => dayKey.format(x);
  const shift = (days: number) => key(new Date(now.getTime() + days * 86_400_000));
  const day = key(d) === key(now) ? "Hoy" : key(d) === shift(-1) ? "Ayer" : key(d) === shift(1) ? "Mañana" : dayMonth.format(d);
  return `${day} ${hour.format(d)}`;
}

export const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
