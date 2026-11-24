import { z } from "zod";
import { userRoleSchema, type UserRole } from "./auth";

/**
 * Configuración del ERP (D-067): usuarios con sus roles y tableros, máquinas, motivos de error y
 * avisos de la campanita. Los roles son los tres de la E1 (D-017); la matriz de permisos a medida es
 * de la E3.
 */

/** Contraseña del personal: mínimo 10 caracteres. */
export const staffPasswordSchema = z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres").max(200);

const rolesSchema = z.array(userRoleSchema).min(1, "Elegí al menos un rol").max(3);
const sectorIdsSchema = z.array(z.string().min(1)).max(50);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Poné el nombre").max(80),
  email: z.string().trim().toLowerCase().email("El email no es válido"),
  roles: rolesSchema,
  /** Tableros que ve (solo importa para Producción: dueño y atención ven todos). */
  sectorIds: sectorIdsSchema.default([]),
  /** Puede ver los totales en pesos de Inicio (D-089). El dueño los ve siempre. */
  canSeeBilling: z.boolean().default(false),
  password: staffPasswordSchema,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email("El email no es válido"),
    roles: rolesSchema,
    sectorIds: sectorIdsSchema,
    canSeeBilling: z.boolean(),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");

export const setStaffPasswordSchema = z.object({ password: staffPasswordSchema });

/** Qué puede hacer cada rol hoy. Es informativo: lo que manda es el control de la API. */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: [
    "Todo lo de Atención y Producción, en todos los tableros",
    "Usuarios, roles, tableros, máquinas y motivos de error",
    "Prender o apagar los avisos automáticos y el control de archivos",
    "Imprimir sin seña, eliminar pedidos y dar de baja clientes",
    "Ver los totales en pesos de Inicio y decidir quién más los ve",
  ],
  ATTENTION: [
    "Conversaciones: responder por la app o por mail, y prender el bot en un chat",
    "Clientes: altas, aprobar o rechazar, editar e invitar a la app",
    "Pedidos de todos los tableros: ver, cotizar y mover",
  ],
  PRODUCTION: ["Ver y mover los pedidos de sus tableros", "Descargar el archivo del pedido y corregir la medida", "Asignar la máquina"],
};

export const machineSchema = z.object({
  name: z.string().trim().min(2, "Poné el nombre").max(60),
  sectorIds: sectorIdsSchema.default([]),
});
export const updateMachineSchema = z
  .object({ name: z.string().trim().min(2).max(60), sectorIds: sectorIdsSchema, active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");

export const errorReasonSchema = z.object({ label: z.string().trim().min(3, "Escribí el motivo").max(80) });
export const updateErrorReasonSchema = z
  .object({ label: z.string().trim().min(3).max(80), active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");

/** Avisos de la campanita (D-067). Los tiempos los cambia el dueño en Configuración. */
export const alertSettingsSchema = z.object({
  /** Un chat con mensajes sin leer hace más de estos minutos se marca "sin atención". */
  unansweredMinutes: z.coerce.number().int().min(5).max(24 * 60),
  /** Un pedido en "Archivo recibido" sin cotizar hace más de estas horas. */
  unquotedHours: z.coerce.number().int().min(1).max(24 * 14),
  /** Un alta pendiente sin aprobar hace más de estas horas. */
  pendingSignupHours: z.coerce.number().int().min(1).max(24 * 30),
  /** Un pedido que lleva más de estas horas en el mismo paso cuenta como demorado (SPEC E1.6). */
  delayedHours: z.coerce.number().int().min(1).max(24 * 30).default(24),
  /** Los tiempos del taller se cuentan solo dentro del horario de atención (D-073). Apagado = horas corridas. */
  businessHoursOnly: z.boolean().default(false),
  /** El cliente ve en la app sus pedidos cancelados (D-073). */
  showCancelledToCustomer: z.boolean().default(true),
});
export type AlertSettings = z.infer<typeof alertSettingsSchema>;
export const DEFAULT_ALERT_SETTINGS: AlertSettings = { unansweredMinutes: 30, unquotedHours: 4, pendingSignupHours: 24, delayedHours: 24, businessHoursOnly: false, showCancelledToCustomer: true };

/** El cliente vuelve a pedir un pedido cancelado, tal cual o con cambios (D-075). */
export const reorderSchema = z.object({
  /** Medida nueva, si la cambia. */
  measure: z.string().trim().max(80).optional(),
  /** Qué cambia o qué quiere aclarar. */
  note: z.string().trim().max(500).optional(),
});
export type ReorderInput = z.infer<typeof reorderSchema>;
