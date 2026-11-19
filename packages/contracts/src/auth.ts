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

/** Ingreso del cliente a la app con email y contraseña (D-039). */
export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("El email no es válido"),
  password: z.string().min(1, "Ingresá la contraseña"),
});
export type CustomerLoginInput = z.input<typeof customerLoginSchema>;

/** El asesor pone o cambia la contraseña de la app de un cliente (D-039). */
export const setAppPasswordSchema = z.object({ password: customerPasswordSchema });

/** Contraseñas del personal: mínimo 10 caracteres. */
export const passwordSchema = z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres").max(200);
