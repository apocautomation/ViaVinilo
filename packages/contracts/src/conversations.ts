import { z } from "zod";
import type { CustomerStatus } from "./customers";
import type { JobStatus } from "./job-status";

/** Bandeja de Conversaciones (D-041, D-045). */
export const MESSAGE_CHANNELS = ["APP", "MAIL"] as const;
export const messageChannelSchema = z.enum(MESSAGE_CHANNELS);
export type MessageChannel = z.infer<typeof messageChannelSchema>;

/** HUMAN: chats que el bot derivó a un asesor (D-056). */
export const CONVERSATION_FILTERS = ["ALL", "UNREAD", "HUMAN", "APP", "MAIL"] as const;

export const listConversationsSchema = z.object({
  filter: z.enum(CONVERSATION_FILTERS).default("ALL"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListConversationsQuery = z.input<typeof listConversationsSchema>;

const textSchema = z.string().trim().min(1, "Escribí un mensaje").max(5000, "El mensaje es muy largo");

/** El asesor responde: por la app (lo ve en el chat) o por mail (sale desde la casilla del sector). */
export const sendMessageSchema = z.object({ text: textSchema, channel: messageChannelSchema });
export type SendMessageInput = z.input<typeof sendMessageSchema>;

/** El cliente escribe desde la pestaña Chat de la app (D-045). */
export const appChatMessageSchema = z.object({ text: textSchema });

/**
 * "/reset" (D-061): borra la memoria del bot con ese cliente, para probar desde cero. Vale por el
 * chat de la app o por mail (la primera línea del mail). No borra mensajes: el equipo ve todo.
 */
export const RESET_REPLY = "Memoria borrada correctamente.";
export function isResetCommand(text: string): boolean {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return first.trim().toLowerCase() === "/reset";
}

/** Prende o apaga el bot: en general (solo el dueño) o en un chat (D-056). */
export const botToggleSchema = z.object({ enabled: z.boolean() });

/** Cliente de un hilo de la bandeja (`GET /conversations`). */
export interface ConversationCustomerRef {
  id: string;
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  status: CustomerStatus;
}

export interface ConversationRow {
  id: string;
  customer: ConversationCustomerRef | null;
  contactEmail: string | null;
  contactName: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  staffUnread: number;
  lastChannel: MessageChannel | null;
  botEnabled: boolean;
  needsHuman: boolean;
}

export interface ConversationMessage {
  id: string;
  direction: "IN" | "OUT";
  channel: MessageChannel;
  subject: string | null;
  body: string;
  attachments: unknown;
  jobId: string | null;
  fromEmail: string | null;
  createdAt: string;
  sector: { name: string } | null;
  author: { name: string } | null;
  fromBot: boolean;
  /** Mail que vino de una casilla nuestra (un reenvío del equipo): va del lado del equipo (D-057). */
  fromStaff?: boolean;
}

/** Un hilo completo (`GET /conversations/:id`). */
export interface ConversationThread {
  id: string;
  botEnabled: boolean;
  needsHuman: boolean;
  needsHumanReason: string | null;
  customer:
    | (ConversationCustomerRef & { emails: { email: string }[]; phones: { phone: string }[]; internalNotes: string | null; appPasswordSetAt: string | null })
    | null;
  contactEmail: string | null;
  contactName: string | null;
  messages: ConversationMessage[];
  jobs: { id: string; label: string; status: JobStatus; description: string | null; quotedAmount: string | null; sector: { name: string } }[];
}
