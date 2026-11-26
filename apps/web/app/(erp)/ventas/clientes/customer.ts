import { maskCuit, maskDni } from "@viavinilo/contracts";
import type { CustomerDetail, CustomerStatus } from "@viavinilo/contracts";
import type { Tone } from "../../ui";

export const STATUS_TONE: Record<CustomerStatus, Tone> = { ACTIVE: "ok", PENDING: "warn", BLOCKED: "bad" };

export const fullName = (c: Pick<CustomerDetail, "firstName" | "lastName">) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ") || "Sin nombre";

/** 30500010912 → 30-50001091-2 */
export const formatCuit = (cuit: string) => maskCuit(cuit);

/** 30111222 → 30.111.222 */
export const formatDni = (dni: string) => maskDni(dni);

/** Estado del acceso a la app para la lista y la ficha (D-049). */
export function appAccess(c: Pick<CustomerDetail, "appPasswordSetAt" | "appInvitedAt" | "emails">): string {
  if (c.appPasswordSetAt) return "Activa";
  if (c.appInvitedAt) return "Invitado";
  return c.emails.length ? "Sin invitar" : "—";
}
