import { z } from "zod";
import { customerPasswordSchema } from "./auth";
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

/** Condición frente al IVA (D-038). Coincide con el enum `TaxCondition` de Prisma. */
export const TAX_CONDITIONS = ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"] as const;
export const taxConditionSchema = z.enum(TAX_CONDITIONS);
export type TaxCondition = z.infer<typeof taxConditionSchema>;

export const TAX_CONDITION_LABELS: Record<TaxCondition, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  CONSUMIDOR_FINAL: "Consumidor final",
};

/** CUIT/CUIL: 11 dígitos con dígito verificador válido. Se aceptan guiones y espacios al cargarlo. */
export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "");
}

export function isValidCuit(cuit: string): boolean {
  const d = normalizeCuit(cuit);
  if (!/^\d{11}$/.test(d)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(d[10]);
}

export const cuitSchema = z
  .string()
  .transform(normalizeCuit)
  .refine(isValidCuit, "El CUIT no es válido: revisá los 11 números");

/** Avisos al cliente (D-038). Sin valor guardado = los dos prendidos. */
export const notificationPrefsSchema = z.object({ push: z.boolean(), email: z.boolean() });
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { push: true, email: true };

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || undefined).optional();

/**
 * Datos de la ficha que no son la identidad ni los contactos (D-038). Los fiscales son para
 * facturar con ARCA en la E3 y son opcionales hasta entonces.
 */
const profileFields = {
  businessName: optionalText(120),
  cuit: z.union([z.literal("").transform(() => undefined), cuitSchema]).optional(),
  legalName: optionalText(160),
  taxCondition: taxConditionSchema.optional(),
  fiscalAddress: optionalText(200),
  city: optionalText(80),
  province: optionalText(80),
  creditEnabled: z.boolean().optional(),
  notificationPrefs: notificationPrefsSchema.optional(),
};

/** Alta de cliente desde el ERP (D-038). Datos mínimos de la actualización §2.1 más la ficha. */
export const createCustomerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  dni: dniSchema,
  emails: z.array(emailSchema).min(1, "Cargá al menos un email"),
  phones: z.array(phoneSchema).min(1, "Cargá al menos un teléfono"),
  internalNotes: z.string().trim().max(2000).optional(),
  isTrade: z.boolean().optional(),
  ...profileFields,
  /** Contraseña de la app (D-039). Opcional: sin ella el cliente no puede entrar hasta que se la carguen. */
  appPassword: z.union([z.literal("").transform(() => undefined), customerPasswordSchema]).optional(),
});
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

/** En la edición, null borra el dato. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

export const updateCustomerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    dni: dniSchema,
    internalNotes: z.string().trim().max(2000).nullable(),
    isTrade: z.boolean(),
    businessName: nullableText(120),
    cuit: z.union([z.literal("").transform(() => null), z.null(), cuitSchema]),
    legalName: nullableText(160),
    taxCondition: taxConditionSchema.nullable(),
    fiscalAddress: nullableText(200),
    city: nullableText(80),
    province: nullableText(80),
    creditEnabled: z.boolean(),
    notificationPrefs: notificationPrefsSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const addEmailSchema = z.object({ email: emailSchema, isPrimary: z.boolean().optional() });
export const addPhoneSchema = z.object({ phone: phoneSchema, isPrimary: z.boolean().optional() });

/** Filtros de "datos a completar" (D-049). */
export const CUSTOMER_GAPS = ["NO_EMAIL", "NO_DNI", "NO_APP_PASSWORD"] as const;
export const customerGapSchema = z.enum(CUSTOMER_GAPS);
export type CustomerGap = z.infer<typeof customerGapSchema>;

export const listCustomersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: customerStatusSchema.optional(),
  gap: customerGapSchema.optional(),
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
