import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";

/** Arma un mail crudo (MIME), como el que baja de IMAP o de MailHog. */
export function buildMail(options: Mail.Options & { messageId?: string; headers?: Record<string, string> }) {
  return new Promise<Buffer>((resolve, reject) =>
    new MailComposer({ date: new Date("2026-11-18T13:00:00Z"), ...options }).compile().build((err, msg) =>
      err ? reject(err) : resolve(msg),
    ),
  );
}

/** Un archivo de impresión de mentira (los tests no necesitan un PDF real). */
export const fakePdf = (name: string, size = 1024) => ({
  filename: name,
  content: Buffer.alloc(size, name),
  contentType: "application/pdf",
});
