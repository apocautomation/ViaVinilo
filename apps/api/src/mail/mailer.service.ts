import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envío de mails desde la API (por ahora, el código de ingreso a la app, D-038).
 * Sin SMTP_URL: en desarrollo el mail se escribe en el log; en producción no se puede enviar.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger("Mailer");
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor() {
    const url = process.env.SMTP_URL?.trim();
    this.transport = url ? nodemailer.createTransport(url) : null;
    this.from = process.env.SMTP_FROM ?? "Via Vinilo <no-responder@viavinilo.local>";
  }

  /** false = no hay forma de entregar el mail (producción sin SMTP). */
  canSend(): boolean {
    return this.transport !== null || process.env.NODE_ENV !== "production";
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (!this.transport) {
      if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL no está configurado");
      this.logger.warn(`[sin SMTP, solo desarrollo] para ${mail.to} · ${mail.subject}\n${mail.text}`);
      return;
    }
    await this.transport.sendMail({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      headers: { "Auto-Submitted": "auto-generated" },
    });
  }
}
