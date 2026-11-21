/**
 * Colas del worker. Los procesadores se agregan en los pasos siguientes del plan de la E1:
 * - mail-ingest: lectura IMAP de las casillas de Hostinger por sector (paso 3, D-007).
 * - notifications: push y email de respaldo (paso 6 y 7).
 * - file-retention: borrado de archivos a los 30 días de entregada la orden (D-015).
 */
export const QUEUES = {
  mailIngest: "mail-ingest",
  notifications: "notifications",
  fileRetention: "file-retention",
  /** Cola de mails a clientes: invitaciones y links de activación (D-049). */
  outbox: "outbox",
  /** Respuestas del bot en el chat de la app (D-056). */
  bot: "bot-replies",
  /** Avisos automáticos de estado al cliente (D-060). */
  notices: "status-notices",
  /** Control automático del archivo (D-065). */
  fileCheck: "file-check",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** BullMQ no acepta ":" en los nombres de cola. */
export function isValidQueueName(name: string): boolean {
  return name.length > 0 && !name.includes(":");
}
