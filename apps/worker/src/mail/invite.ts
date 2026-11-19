import type { Sector } from "@prisma/client";
import nodemailer from "nodemailer";
import type { IngestNotifier } from "./ingest";

export interface SmtpConfig {
  url: string;
  from: string;
  /** Link de WhatsApp de la empresa (wa.me). Vacío mientras no se tenga el número (D-038). */
  contactUrl: string;
}

/**
 * Texto del mail a un remitente que no es cliente (D-014, cambiado por D-038): no hay autoalta,
 * el alta la hace un asesor después de que el cliente escribe por WhatsApp. Sin promesas.
 */
export function signupInviteText(contactUrl: string, subject: string | null): string {
  const ref = subject ? ` ("${subject}")` : "";
  const contact = contactUrl.trim()
    ? `Escribinos por WhatsApp acá: ${contactUrl.trim()}`
    : "Escribinos por WhatsApp a Via Vinilo.";
  return [
    "¡Hola!",
    "",
    `Recibimos tu mail${ref} en Via Vinilo. Para imprimir tus trabajos tenés que estar dado de alta como cliente del gremio.`,
    "",
    `${contact} Un asesor te da de alta y te deja listo el acceso a la app.`,
    "",
    "Tu trabajo quedó guardado: cuando un asesor apruebe el alta, pasa a producción y lo vas a poder seguir desde la app.",
    "",
    "Via Vinilo · Mayorista gráfico",
  ].join("\n");
}

export function createSmtpNotifier(config: SmtpConfig): IngestNotifier {
  // Sin SMTP configurado (producción antes de tener las casillas, D-037) el worker igual arranca:
  // el mail de alta no se manda y queda en el log. La orden se crea igual.
  if (!config.url.trim()) {
    return {
      async sendSignupInvite({ to }) {
        console.warn(`[mail] SMTP_URL vacío: no se envió el mail de alta a ${to}`);
      },
    };
  }
  const transport = nodemailer.createTransport(config.url);
  return {
    async sendSignupInvite({ to, sector, subject }: { to: string; sector: Sector; subject: string | null }) {
      await transport.sendMail({
        from: config.from,
        to,
        // Las respuestas vuelven a la casilla del sector, no a la de DTF (actualización §2.2).
        replyTo: sector.inboxEmail ?? undefined,
        subject: "Via Vinilo · Cómo darte de alta para imprimir",
        text: signupInviteText(config.contactUrl, subject),
        headers: { "Auto-Submitted": "auto-generated" },
      });
    },
  };
}
