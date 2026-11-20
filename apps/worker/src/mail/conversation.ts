import { Prisma, type PrismaClient, type Sector } from "@prisma/client";
import type { ParsedMail } from "./parse";

/** Lo que se guarda del cuerpo del mail en el hilo. */
const MAX_MESSAGE_CHARS = 20_000;
const PREVIEW_CHARS = 140;

/**
 * Hilo de un cliente, o de un remitente que todavía no es cliente (por su email). Si el remitente
 * ya tenía un hilo por email y ahora es cliente, ese hilo pasa a ser el del cliente (D-045).
 */
export async function conversationFor(
  prisma: PrismaClient,
  who: { customerId: string | null; email: string | null; name: string | null },
): Promise<string> {
  if (who.customerId) {
    const own = await prisma.conversation.findUnique({ where: { customerId: who.customerId }, select: { id: true } });
    if (own) return own.id;
    if (who.email) {
      const byEmail = await prisma.conversation.findUnique({ where: { contactEmail: who.email }, select: { id: true } });
      if (byEmail) {
        await prisma.conversation.update({ where: { id: byEmail.id }, data: { customerId: who.customerId, contactEmail: null } });
        return byEmail.id;
      }
    }
    return upsertSafe(prisma, { customerId: who.customerId }, { customerId: who.customerId });
  }
  if (!who.email) throw new Error("Un hilo necesita un cliente o un email");
  return upsertSafe(prisma, { contactEmail: who.email }, { contactEmail: who.email, contactName: who.name });
}

/** Crea el hilo; si otro proceso lo creó al mismo tiempo, devuelve ese. */
async function upsertSafe(
  prisma: PrismaClient,
  where: Prisma.ConversationWhereUniqueInput,
  data: Prisma.ConversationUncheckedCreateInput,
): Promise<string> {
  try {
    return (await prisma.conversation.create({ data, select: { id: true } })).id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    return (await prisma.conversation.findUniqueOrThrow({ where, select: { id: true } })).id;
  }
}

export const preview = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

/**
 * Guarda un mail entrante en el hilo del cliente (D-041, D-045): con o sin adjuntos, cree o no una
 * orden. Es idempotente: el mismo mail leído dos veces en la misma casilla no se repite.
 */
export async function recordInboundMail(
  prisma: PrismaClient,
  input: {
    sector: Sector;
    mail: ParsedMail;
    customerId: string | null;
    jobId?: string;
    uid?: number;
    /** Quién mandó el mail de verdad, si no es el cliente (un reenvío desde una casilla nuestra, D-057). */
    senderEmail?: string | null;
  },
): Promise<void> {
  const { sector, mail } = input;
  if (!mail.fromEmail) return;
  const conversationId = await conversationFor(prisma, {
    customerId: input.customerId,
    email: mail.fromEmail,
    name: mail.fromName,
  });
  const body = mail.text.trim().slice(0, MAX_MESSAGE_CHARS) || "(mail sin texto)";
  try {
    await prisma.message.create({
      data: {
        conversationId,
        direction: "IN",
        channel: "MAIL",
        sectorId: sector.id,
        fromEmail: input.senderEmail ?? mail.fromEmail,
        subject: mail.subject,
        body,
        attachments: mail.files.length ? mail.files.map((f) => f.filename) : undefined,
        jobId: input.jobId,
        externalKey: `${sector.code}:${mail.messageId}`,
        mailUid: input.uid,
        createdAt: mail.sentAt ?? undefined,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: preview(mail.subject ? `${mail.subject} · ${body}` : body),
      staffUnread: { increment: 1 },
    },
  });
}
