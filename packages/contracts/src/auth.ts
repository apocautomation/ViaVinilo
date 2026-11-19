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

/** Ingreso del cliente a la app: pide un código al email (D-016, D-038). */
export const requestLoginCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("El email no es válido"),
});
export type RequestLoginCodeInput = z.input<typeof requestLoginCodeSchema>;

export const verifyLoginCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("El email no es válido"),
  code: z
    .string()
    .transform((c) => c.replace(/\D/g, ""))
    .refine((c) => c.length === 6, "El código tiene 6 números"),
});
export type VerifyLoginCodeInput = z.input<typeof verifyLoginCodeSchema>;

/** Contraseñas del personal: mínimo 10 caracteres. */
export const passwordSchema = z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres").max(200);
