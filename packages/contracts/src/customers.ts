import { z } from "zod";
import { normalizeDni, normalizeEmail, normalizePhone } from "./contact";

export const CUSTOMER_STATUSES = ["PENDING", "ACTIVE", "BLOCKED"] as const;
export const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  PENDING: "Alta pendiente",
  ACTIVE: "Activo",
  BLOCKED: "Bloqueado",
};

export const emailSchema = z
  .string()
  .trim()
  .email("El email no es válido")
  .transform(normalizeEmail);

export const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "El teléfono no es válido" });
    return z.NEVER;
  }
  return phone;
});

/** DNI argentino: 7 u 8 dígitos. Se aceptan puntos y espacios al cargarlo. */
export const dniSchema = z
  .string()
  .transform(normalizeDni)
  .refine((d) => /^\d{7,8}$/.test(d), "El DNI tiene que tener 7 u 8 números");

const nameSchema = z.string().trim().min(1, "No puede estar vacío").max(80);

/** Alta de cliente desde el backoffice. Datos mínimos de la actualización §2.1. */
export const createCustomerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  dni: dniSchema,
  emails: z.array(emailSchema).min(1, "Cargá al menos un email"),
  phones: z.array(phoneSchema).min(1, "Cargá al menos un teléfono"),
  internalNotes: z.string().trim().max(2000).optional(),
  isTrade: z.boolean().optional(),
});
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    dni: dniSchema,
    internalNotes: z.string().trim().max(2000).nullable(),
    isTrade: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const addEmailSchema = z.object({ email: emailSchema, isPrimary: z.boolean().optional() });
export const addPhoneSchema = z.object({ phone: phoneSchema, isPrimary: z.boolean().optional() });

export const listCustomersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: customerStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListCustomersQuery = z.input<typeof listCustomersSchema>;

export const blockCustomerSchema = z.object({
  reason: z.string().trim().min(1, "Indicá el motivo").max(500),
});

/**
 * Datos mínimos para que un asesor apruebe el alta (actualización §2.1): nombre, apellido, DNI,
 * al menos un email y al menos un teléfono. Devuelve los campos que faltan (vacío = se puede aprobar).
 */
export function missingFieldsForApproval(c: {
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  emailCount: number;
  phoneCount: number;
}): string[] {
  const missing: string[] = [];
  if (!c.firstName) missing.push("nombre");
  if (!c.lastName) missing.push("apellido");
  if (!c.dni) missing.push("DNI");
  if (c.emailCount < 1) missing.push("email");
  if (c.phoneCount < 1) missing.push("teléfono");
  return missing;
}
