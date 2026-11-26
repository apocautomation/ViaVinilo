import type { AppJobStatus } from "@viavinilo/contracts";

/** Clase de color de cada estado en la app de clientes (D-034). Los textos son `JOB_STATUS_LABELS`. */
export const STATUS_CLASS: Record<AppJobStatus, string> = {
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

const SALTA = "America/Argentina/Salta";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: SALTA });
// Siempre 24 h (D-091), como el ERP: "17:30" y no "05:30 p. m.".
const hour = new Intl.DateTimeFormat("es-AR", { timeZone: SALTA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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
