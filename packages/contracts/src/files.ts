import { z } from "zod";
import { sectorCodeSchema } from "./sectors";
import { pickupBranchSchema } from "./pickup";

/**
 * Archivos en Conversaciones (D-062): el cliente manda su archivo por el chat de la app (y se crea
 * el pedido) y el asesor adjunta archivos al responder, por la app o por mail.
 */

/** Un archivo de impresión puede ser grande (un DTF de 58 × 300 cm a 300 dpi). */
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;
/** Lo que entra en un mail: la casilla y el cliente suelen rechazar mails más grandes. */
export const MAX_MAIL_ATTACHMENTS_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 5;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "tif", "tiff", "ai", "eps", "psd", "cdr", "svg", "zip", "rar"] as const;
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function extensionOf(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
}

export function isAllowedFile(name: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

/** Nombre seguro para guardar: sin rutas ni caracteres raros, pero legible. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "archivo";
  const clean = base
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._ ()-]+/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-120);
  return clean || "archivo";
}

/** El cliente manda su archivo por el chat: elige el servicio y puede agregar medidas o aclaraciones. */
export const appUploadSchema = z
  .object({
  /** Servicio del trabajo nuevo. No hace falta si el archivo es para un pedido que ya existe (`job`). */
  sector: sectorCodeSchema.optional(),
  /** Material u opción de impresión elegida (D-095). */
  variant: z.string().min(1).max(40).optional(),
  /** Número de un pedido del cliente al que se le suma este archivo (D-094). */
  job: z.coerce.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional(),
  /** Sucursal donde retira (D-083). Opcional para no romper la app ya instalada; la app nueva siempre la manda. */
  pickupBranch: pickupBranchSchema.optional(),
  /**
   * Medidas y copias cargadas en el formulario de "Enviar" (D-087), ya en centímetros. Con esto el
   * pedido nace con la medida exacta, sin tener que leerla de un texto libre.
   */
  widthCm: z.coerce.number().positive().max(100_000).optional(),
  heightCm: z.coerce.number().positive().max(100_000).optional(),
  copies: z.coerce.number().int().min(1).max(100_000).optional(),
  })
  .refine((v) => v.sector || v.job, { message: "Elegí un servicio o un pedido", path: ["sector"] });
export type AppUploadInput = z.input<typeof appUploadSchema>;

/** El asesor responde con archivos (y texto opcional), por la app o por mail. */
export const staffUploadSchema = z.object({
  text: z.string().trim().max(5000).optional(),
  channel: z.enum(["APP", "MAIL"]),
});

/** Cómo se guarda un adjunto en el mensaje. Los mails viejos guardaban solo el nombre (string). */
export interface MessageAttachment {
  name: string;
  /** Clave en el almacenamiento. Sin clave, el archivo solo se ve en el pedido (mails entrantes). */
  key?: string;
  size?: number;
  mime?: string;
}

export function attachmentsOf(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a): MessageAttachment | null =>
      typeof a === "string"
        ? { name: a }
        : a && typeof a === "object" && typeof (a as MessageAttachment).name === "string"
          ? (a as MessageAttachment)
          : null,
    )
    .filter((a): a is MessageAttachment => a !== null);
}

/** "12,4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
