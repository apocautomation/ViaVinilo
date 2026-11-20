import { maskCuit, maskDni } from "@viavinilo/contracts";
import type { CustomerStatus, NotificationPrefs, TaxCondition } from "@viavinilo/contracts";
import type { Tone } from "../../ui";

export const STATUS_TONE: Record<CustomerStatus, Tone> = { ACTIVE: "ok", PENDING: "warn", BLOCKED: "bad" };

/** Cliente como lo devuelve la API (`GET /customers/:id`). */
export interface Customer {
  id: string;
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  status: CustomerStatus;
  internalNotes: string | null;
  isTrade: boolean;
  businessName: string | null;
  cuit: string | null;
  legalName: string | null;
  taxCondition: TaxCondition | null;
  fiscalAddress: string | null;
  city: string | null;
  province: string | null;
  creditEnabled: boolean;
  notificationPrefs: NotificationPrefs | null;
  emails: { id: string; email: string; isPrimary: boolean }[];
  phones: { id: string; phone: string; isPrimary: boolean }[];
  /** Cuándo se cargó la contraseña de la app. Null = no puede entrar (D-039). */
  appPasswordSetAt: string | null;
  /** Última invitación a la app (D-049). */
  appInvitedAt: string | null;
  importSource: string | null;
  createdAt: string;
}

export interface CustomerPage {
  total: number;
  page: number;
  pageSize: number;
  items: Customer[];
}

export const fullName = (c: Pick<Customer, "firstName" | "lastName">) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || "Sin nombre";

/** +5493874669944 → 387 466-9944 (celulares argentinos, I-12). Otros números quedan como están. */
export function formatPhone(phone: string): string {
  const m = /^\+549(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `${m[1]} ${m[2]}-${m[3]}` : phone;
}

/** 30500010912 → 30-50001091-2 */
export const formatCuit = (cuit: string) => maskCuit(cuit);

/** 30111222 → 30.111.222 */
export const formatDni = (dni: string) => maskDni(dni);

/** Estado del acceso a la app para la lista y la ficha (D-049). */
export function appAccess(c: Pick<Customer, "appPasswordSetAt" | "appInvitedAt" | "emails">): string {
  if (c.appPasswordSetAt) return "Activa";
  if (c.appInvitedAt) return "Invitado";
  return c.emails.length ? "Sin invitar" : "—";
}
