import { z } from "zod";

/** Roles mínimos de la E1 (D-017). Coincide con el enum `UserRole` de Prisma. */
export const USER_ROLES = ["OWNER", "PRODUCTION", "ATTENTION"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Dueño",
  PRODUCTION: "Producción",
  ATTENTION: "Atención",
};

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("El email no es válido"),
  password: z.string().min(1, "Ingresá la contraseña"),
});
export type LoginInput = z.input<typeof loginSchema>;

/** Contraseña de la app de clientes: mínimo 8 caracteres. La carga el asesor (D-039). */
export const customerPasswordSchema = z
  .string()
  .min(8, "La contraseña de la app tiene que tener al menos 8 caracteres")
  .max(200);

/** Ingreso del cliente a la app con email **o teléfono** y contraseña (D-039, D-049). */
export const customerLoginSchema = z.object({
  user: z.string().trim().min(1, "Ingresá tu email o tu celular").max(200),
  password: z.string().min(1, "Ingresá la contraseña"),
});
export type CustomerLoginInput = z.input<typeof customerLoginSchema>;

/** El cliente pide el link para crear su contraseña (D-049). */
export const requestActivationSchema = z.object({
  email: z.string().trim().toLowerCase().email("El email no es válido"),
});

/** El cliente crea su contraseña con el link que le llegó por mail (D-049). */
export const completeActivationSchema = z.object({
  token: z.string().min(20).max(200),
  password: customerPasswordSchema,
});

/** El asesor invita a la app a uno, varios o todos los que tienen email y todavía no tienen contraseña (D-049). */
export const inviteCustomersSchema = z
  .object({
    customerIds: z.array(z.string().min(1)).max(500).optional(),
    allPending: z.boolean().optional(),
  })
  .refine((v) => (v.customerIds?.length ?? 0) > 0 || v.allPending === true, "Elegí a quién invitar");

/** El asesor pone o cambia la contraseña de la app de un cliente (D-039). */
export const setAppPasswordSchema = z.object({ password: customerPasswordSchema });

/** Contraseñas del personal: mínimo 10 caracteres. */
export const passwordSchema = z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres").max(200);
