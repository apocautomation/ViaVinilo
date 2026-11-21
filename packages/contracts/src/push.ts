import { z } from "zod";

/**
 * Notificaciones push de la app de clientes (D-068). El navegador entrega una dirección de su
 * servicio de push y dos claves; con eso el sistema le manda el aviso al celular.
 */

/** Servicios de push de los navegadores. No se acepta ninguna otra dirección: el sistema le escribe a esa URL. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];

export function isPushEndpoint(url: string): boolean {
  // Solo https, sin usuario ni puerto: el host es lo que va entre "https://" y la primera barra.
  const host = /^https:\/\/([a-z0-9.-]+)\/[^\s]*$/i.exec(url)?.[1]?.toLowerCase();
  return host !== undefined && PUSH_HOSTS.some((re) => re.test(host));
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "La suscripción no es de un navegador conocido"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().max(1000) });

/** Lo que recibe el celular. */
export interface PushPayload {
  title: string;
  body: string;
  /** Pantalla de la app que se abre al tocar el aviso. */
  url: string;
}

const PUSH_BODY_CHARS = 160;

/** Arma el aviso a partir de un mensaje del chat (aviso automático de un pedido o respuesta del equipo). */
export function pushPayloadFor(message: { subject: string | null; body: string; attachments?: number }): PushPayload {
  const text = message.body.replace(/\s+/g, " ").trim();
  const body = text.length > PUSH_BODY_CHARS ? `${text.slice(0, PUSH_BODY_CHARS - 1).trimEnd()}…` : text;
  return {
    title: message.subject === "Aviso automático" ? "Via Vinilo · novedades de tu pedido" : "Via Vinilo · mensaje nuevo",
    body: body || (message.attachments ? "Te mandamos un archivo." : "Tenés un mensaje nuevo."),
    url: "/chat",
  };
}
