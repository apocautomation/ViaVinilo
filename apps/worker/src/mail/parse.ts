import { createHash } from "node:crypto";
import { simpleParser, type Attachment, type HeaderValue } from "mailparser";
import { normalizeEmail } from "@viavinilo/contracts";
import { extractTransferLinks } from "./links";
import { extractMeasures, type DeclaredMeasure } from "./measures";

export interface MailFile {
  filename: string;
  mime: string;
  content: Buffer;
  size: number;
  checksum: string;
}

export interface ParsedMail {
  /** Message-ID del encabezado, o uno sintético (hash del contenido) si el mail no lo trae. */
  messageId: string;
  fromEmail: string | null;
  fromName: string | null;
  subject: string | null;
  sentAt: Date | null;
  text: string;
  isAutoReply: boolean;
  files: MailFile[];
  links: string[];
  measures: DeclaredMeasure[];
}

/** Imágenes incrustadas de firma (logos en el pie): no son trabajos de impresión. */
const MAX_INLINE_SIGNATURE_BYTES = 200 * 1024;

function isSignatureImage(a: Attachment): boolean {
  return (
    a.contentDisposition === "inline" &&
    Boolean(a.cid) &&
    a.contentType.startsWith("image/") &&
    a.size < MAX_INLINE_SIGNATURE_BYTES
  );
}

function headerText(value: HeaderValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in value) return String(value.value);
  return String(value);
}

/** Respuestas automáticas, rebotes y listas: no son pedidos de un cliente. */
/**
 * Aviso de mail no entregado (D-112): Exchange y otros servidores lo mandan sin remitente y con asuntos
 * como "Sin entregar: RE: dtf textil" o "Undeliverable: …". Hostinger los dejaba en dtf@ cuando esa
 * casilla no podía enviar (I-22) y quedaban como error "El mail no tiene remitente".
 */
const BOUNCE_SUBJECT =
  /^\s*(sin entregar|no entregado|no se pudo entregar|undeliverable|undelivered|delivery status notification|mail delivery (failed|subsystem)|returned mail|failure notice|delivery failure|mensaje devuelto)\b/i;

export function isBounce(subject: string | null | undefined, fromEmail: string | null, hasDeliveryReport = false): boolean {
  if (hasDeliveryReport) return true;
  if (!subject || !BOUNCE_SUBJECT.test(subject)) return false;
  // Con remitente, solo si es un servidor de correo: un cliente puede escribir "Undeliverable" en un asunto.
  return !fromEmail || /^(mailer-daemon|postmaster|no-?reply|microsoftexchange[\w.-]*)@/i.test(fromEmail);
}

function detectAutoReply(headers: Map<string, HeaderValue>, fromEmail: string | null): boolean {
  const auto = headerText(headers.get("auto-submitted")).toLowerCase();
  if (auto && auto !== "no") return true;
  if (headers.has("x-autoreply") || headers.has("x-autorespond") || headers.has("x-auto-response-suppress"))
    return true;
  const precedence = headerText(headers.get("precedence")).toLowerCase();
  if (["bulk", "junk", "list", "auto_reply"].includes(precedence)) return true;
  const contentType = headerText(headers.get("content-type")).toLowerCase();
  if (contentType.includes("multipart/report")) return true;
  if (fromEmail && /^(mailer-daemon|postmaster|no-?reply)@/.test(fromEmail)) return true;
  return false;
}

function safeFilename(name: string | undefined, index: number, mime: string): string {
  // Caracteres no válidos en nombres de archivo de Windows y Linux, y de control (< 0x20).
  const base = [...(name ?? "")]
    .map((ch) => (ch.charCodeAt(0) < 0x20 || '\\/:*?"<>|'.includes(ch) ? "_" : ch))
    .join("")
    .trim();
  if (base) return base.slice(0, 200);
  const ext = mime.split("/")[1]?.split(/[+;]/)[0] ?? "bin";
  return `adjunto-${index + 1}.${ext}`;
}

export async function parseMail(raw: Buffer): Promise<ParsedMail> {
  const mail = await simpleParser(raw, { skipHtmlToText: false, skipTextToHtml: true });
  const from = mail.from?.value[0];
  const fromEmail = from?.address ? normalizeEmail(from.address) : null;
  const text = mail.text ?? "";

  const files = mail.attachments
    .filter((a) => !isSignatureImage(a))
    .map((a, i) => ({
      filename: safeFilename(a.filename, i, a.contentType),
      mime: a.contentType,
      content: a.content,
      size: a.size,
      checksum: createHash("sha256").update(a.content).digest("hex"),
    }));

  const messageId =
    mail.messageId?.trim() || `<sha256-${createHash("sha256").update(raw).digest("hex")}@viavinilo.local>`;

  return {
    messageId,
    fromEmail,
    fromName: from?.name?.trim() || null,
    subject: mail.subject?.trim() || null,
    sentAt: mail.date ?? null,
    text,
    // D-112: los avisos de "no entregado" también son automáticos (aunque lleguen sin remitente).
    isAutoReply:
      detectAutoReply(mail.headers, fromEmail) ||
      isBounce(mail.subject, fromEmail, mail.attachments.some((a) => /^message\/(delivery-status|disposition-notification)/i.test(a.contentType))),
    files,
    links: extractTransferLinks(text, typeof mail.html === "string" ? mail.html : undefined),
    measures: extractMeasures(`${mail.subject ?? ""}\n${text}`),
  };
}
