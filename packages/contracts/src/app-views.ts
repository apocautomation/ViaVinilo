import type { NotificationPrefs } from "./customers";
import type { JobStatus } from "./job-status";

/**
 * Respuestas de la API de la app de clientes (D-034, D-038). La API las arma en
 * `apps/api/src/jobs/app-jobs.controller.ts` y `apps/api/src/app-auth`.
 */

/** El cliente nunca ve "Alta pendiente": para él el pedido está recibido (D-014). */
export type AppJobStatus = Exclude<JobStatus, "PENDING_SIGNUP">;

/** Un pedido como lo manda la API (`GET /app/jobs`): sale directo del tablero de producción. */
export interface AppOrder {
  /** Número del pedido, sin formato: es lo que va en la dirección `/pedidos/418`. */
  id: string;
  num: string;
  sector: string;
  desc: string;
  measure: string;
  /** Material u opción de impresión (D-095). */
  material: string | null;
  status: AppJobStatus;
  steps: AppJobStatus[];
  amount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  depositPaid: boolean;
  readyAt: string | null;
  /** Sucursal donde lo retira (D-083). */
  pickup: string;
  /** El cliente todavía puede cancelarlo desde la app (hasta "Cotizado"). */
  canCancel: boolean;
  /** Todavía se le puede sumar o cambiar el archivo (D-094). */
  canAddFile: boolean;
  /** Está cancelado y se puede volver a pedir. */
  canReorder: boolean;
  error: string | null;
  files: { name: string; size: string; available: boolean }[];
  history: { status: AppJobStatus; at: string }[];
  channel: "App" | "Mail" | "Mostrador";
  createdAt: string;
}

/** El cliente con sesión iniciada (`GET /app/me`). */
export interface AppCustomer {
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  emails: { email: string; isPrimary: boolean }[];
  phones: { phone: string; isPrimary: boolean }[];
  notificationPrefs: NotificationPrefs;
}
