import type { Sector } from "@prisma/client";
import nodemailer from "nodemailer";
import type { IngestNotifier } from "./ingest";

export interface SmtpConfig {
  url: string;
  from: string;
  /** Link de alta de la app de clientes. */
  signupUrl: string;
}

/** Texto del mail de alta (D-014). Español rioplatense, sin promesas. */
export function signupInviteText(signupUrl: string, subject: string | null): string {
  const ref = subject ? ` ("${subject}")` : "";
  return [
    "¡Hola!",
    "",
    `Recibimos tu mail${ref} en Via Vinilo. Para empezar a imprimir tus trabajos necesitamos que te des de alta como cliente del gremio.`,
    "",
    `Completá tus datos acá: ${signupUrl}`,
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
        subject: "Via Vinilo · Completá tu alta para imprimir",
        text: signupInviteText(config.signupUrl, subject),
        headers: { "Auto-Submitted": "auto-generated" },
      });
    },
  };
}
