import { MAX_FILES_PER_MESSAGE, MAX_MAIL_ATTACHMENTS_BYTES } from "@viavinilo/contracts";
import type { ConversationCustomerRef, ConversationMessage, ConversationThread, CustomerStatus, MessageChannel } from "@viavinilo/contracts";
import { ApiError } from "../../../lib/api";
import type { Tone } from "../../ui";

/**
 * Reglas de la bandeja de Conversaciones (D-041, D-045, D-059) sin React: nombres, tiempos,
 * filtros y por dónde sale la respuesta del asesor.
 */

/** D-059: tres pestañas principales; el canal (App / Mail) se elige con el botón de filtros. */
export const TABS = [
  { label: "Todas", value: "ALL" },
  { label: "Sin leer", value: "UNREAD" },
  { label: "Pide asesor", value: "HUMAN" },
] as const;
export const CHANNELS = [
  { label: "Solo chat de la app", value: "APP" },
  { label: "Solo mails", value: "MAIL" },
] as const;
export type Filter = (typeof TABS)[number]["value"] | (typeof CHANNELS)[number]["value"];
/** Cada cuánto se refresca la bandeja (hasta tener avisos en vivo). */
export const REFRESH_MS = 10_000;

export interface BotStatus {
  configured: boolean;
  model: string | null;
  chatsWithBot: number;
  needsHuman: number;
}

export const isChannelFilter = (filter: Filter) => CHANNELS.some((c) => c.value === filter);

export const nameOf = (c: { customer: ConversationCustomerRef | null; contactName: string | null; contactEmail: string | null }) =>
  c.customer
    ? [c.customer.firstName, c.customer.lastName].filter(Boolean).join(" ") || c.customer.businessName || `Cliente N.º ${c.customer.customerNumber}`
    : c.contactName || c.contactEmail || "Sin nombre";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

/** "recién", "hace 5 min", "hace 2 h", "ayer" o la fecha (D-059). */
export function ago(iso: string, now = new Date()) {
  const d = new Date(iso);
  const min = Math.floor((now.getTime() - d.getTime()) / 60_000);
  const today = now.toDateString() === d.toDateString();
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 12 * 60 && today) return `hace ${Math.floor(min / 60)} h`;
  if (today) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString();
  return yesterday ? "ayer" : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function listQuery(filter: Filter, search: string): string {
  const params = new URLSearchParams({ filter, pageSize: "50" });
  if (search) params.set("search", search);
  return params.toString();
}

export const emptyListText = (filter: Filter, search: string) =>
  search || filter !== "ALL" ? "No hay conversaciones con ese filtro." : "Todavía no hay conversaciones.";

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Algo salió mal. Probá de nuevo.");

const lastIn = (thread: ConversationThread, channel?: MessageChannel) =>
  [...thread.messages].reverse().find((m) => m.direction === "IN" && (!channel || m.channel === channel));

/** La app solo sirve si el cliente está activo. Si el último mensaje vino por mail, se contesta por mail. */
export const canAnswerByApp = (thread: ConversationThread) => thread.customer?.status === "ACTIVE";

export function defaultChannel(thread: ConversationThread): MessageChannel {
  return canAnswerByApp(thread) && lastIn(thread)?.channel !== "MAIL" ? "APP" : "MAIL";
}

/** El último mail del cliente: la respuesta por mail sale desde esa casilla y en ese hilo. */
export const lastMailIn = (thread: ConversationThread) => lastIn(thread, "MAIL");

export function channelHint(channel: MessageChannel, lastMail: ConversationMessage | undefined): string {
  if (channel === "APP") return "Lo ve en la pestaña Chat de la app.";
  if (!lastMail) return "Sale desde la casilla de soporte.";
  return `Sale desde la casilla de ${lastMail.sector?.name ?? "Via Vinilo"}, en el mismo hilo de su mail.`;
}

/** Por mail entran hasta 20 MB de adjuntos (D-062). */
export const mailTooBig = (channel: MessageChannel, files: File[]) =>
  channel === "MAIL" && files.reduce((n, f) => n + f.size, 0) > MAX_MAIL_ATTACHMENTS_BYTES;

export const addFiles = (current: File[], picked: File[]) => [...current, ...picked].slice(0, MAX_FILES_PER_MESSAGE);

export function bubbleKind(m: ConversationMessage): "ai" | "staff" | "in" | "out" {
  if (m.fromBot) return "ai";
  if (m.fromStaff) return "staff";
  return m.direction === "IN" ? "in" : "out";
}

export function authorLabel(m: ConversationMessage): string {
  if (m.direction === "OUT") return m.fromBot ? "Bot" : (m.author?.name ?? "Via Vinilo");
  if (m.fromStaff) return `Reenvío del equipo · ${m.fromEmail}`;
  if (m.channel === "MAIL") return m.fromEmail ?? "Mail";
  return "App";
}

const CUSTOMER_BADGE: Record<CustomerStatus, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "ok", label: "Activo" },
  PENDING: { tone: "warn", label: "Alta pendiente" },
  BLOCKED: { tone: "bad", label: "Bloqueado" },
};

export const customerBadge = (status: CustomerStatus) => CUSTOMER_BADGE[status];
