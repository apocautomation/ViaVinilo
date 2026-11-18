import { createHash } from "node:crypto";
import { Prisma, type MailIngestResult, type PrismaClient, type Sector } from "@prisma/client";
import type { FileStorage } from "../storage";
import { parseMail, type ParsedMail } from "./parse";

/** Avisos que dispara la ingesta. En producción manda mails por SMTP (invite.ts). */
export interface IngestNotifier {
  /** Mail con el link de alta a un remitente que todavía no es cliente activo (D-014). */
  sendSignupInvite(input: { to: string; sector: Sector; subject: string | null }): Promise<void>;
}

export interface IngestDeps {
  prisma: PrismaClient;
  storage: FileStorage;
  notifier: IngestNotifier;
  /** Para tests. */
  now?: () => Date;
}

export interface IngestOutcome {
  result: MailIngestResult;
  messageId: string;
  jobId?: string;
  error?: string;
}

/** No se reenvía el link de alta más de una vez por día al mismo remitente. */
const INVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Lo que se guarda del cuerpo del mail en la orden. */
const MAX_BODY_CHARS = 4000;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Procesa un mail de la casilla de un sector (SPEC E1.1, D-014, I-14, I-15).
 * Es idempotente: el mismo mail procesado dos veces no crea dos órdenes.
 * Los errores del mail en sí quedan en el log como ERROR; solo se lanzan los de infraestructura
 * (base de datos caída), para que la lectura se reintente.
 */
export async function ingestMail(deps: IngestDeps, sector: Sector, raw: Buffer): Promise<IngestOutcome> {
  let mail: ParsedMail;
  try {
    mail = await parseMail(raw);
  } catch (err) {
    const messageId = `<unparseable-${createHash("sha256").update(raw).digest("hex")}@viavinilo.local>`;
    const error = err instanceof Error ? err.message : String(err);
    await log(deps, sector, { messageId }, "ERROR", { error });
    return { result: "ERROR", messageId, error };
  }

  const outcome = await decide(deps, sector, mail);
  await deps.prisma.mailboxState.upsert({
    where: { sectorId: sector.id },
    update: { lastMessageAt: (deps.now ?? (() => new Date()))() },
    create: { sectorId: sector.id, lastMessageAt: (deps.now ?? (() => new Date()))() },
  });
  return outcome;
}

async function decide(deps: IngestDeps, sector: Sector, mail: ParsedMail): Promise<IngestOutcome> {
  const { prisma } = deps;
  const base = { messageId: mail.messageId };

  if (mail.isAutoReply) {
    await log(deps, sector, mail, "SKIPPED_AUTO_REPLY");
    return { ...base, result: "SKIPPED_AUTO_REPLY" };
  }

  const existing = await prisma.jobOrder.findUnique({
    where: { sectorId_sourceMessageId: { sectorId: sector.id, sourceMessageId: mail.messageId } },
    select: { id: true },
  });
  if (existing) {
    await log(deps, sector, mail, "DUPLICATE", { jobId: existing.id });
    return { ...base, result: "DUPLICATE", jobId: existing.id };
  }

  if (mail.files.length === 0 && mail.links.length === 0) {
    await log(deps, sector, mail, "SKIPPED_NO_FILES");
    return { ...base, result: "SKIPPED_NO_FILES" };
  }

  if (!mail.fromEmail) {
    const error = "El mail no tiene remitente";
    await log(deps, sector, mail, "ERROR", { error });
    return { ...base, result: "ERROR", error };
  }

  // Cliente por email del remitente; si no existe se crea con alta pendiente (D-014).
  const contact = await prisma.customerEmail.findUnique({
    where: { email: mail.fromEmail },
    include: { customer: true },
  });
  let customer = contact?.customer.deletedAt ? null : (contact?.customer ?? null);

  if (customer?.status === "BLOCKED") {
    await log(deps, sector, mail, "REJECTED_BLOCKED");
    return { ...base, result: "REJECTED_BLOCKED" };
  }

  if (!customer) {
    try {
      customer = await prisma.customer.create({
        data: {
          status: "PENDING",
          internalNotes: mail.fromName ? `Nombre en el mail: ${mail.fromName}` : null,
          emails: { create: { email: mail.fromEmail, isPrimary: true } },
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Otro mail del mismo remitente lo creó al mismo tiempo.
      customer = (await prisma.customerEmail.findUniqueOrThrow({
        where: { email: mail.fromEmail },
        include: { customer: true },
      })).customer;
    }
  }

  const status = customer.status === "ACTIVE" ? "RECEIVED" : "PENDING_SIGNUP";

  // Los archivos se guardan antes de crear la orden, con una clave estable por mail: si la orden
  // ya existe (reintento), solo se sobrescriben con el mismo contenido.
  const folder = `mail/${sector.code.toLowerCase()}/${createHash("sha256").update(mail.messageId).digest("hex").slice(0, 32)}`;
  const files = mail.files.map((f, i) => ({ ...f, storageKey: `${folder}/${i + 1}-${f.filename}` }));
  for (const f of files) await deps.storage.put(f.storageKey, f.content);

  let jobId: string;
  try {
    const job = await prisma.jobOrder.create({
      data: {
        customerId: customer.id,
        sectorId: sector.id,
        status,
        source: "EMAIL",
        sourceMessageId: mail.messageId,
        description: mail.subject,
        requestedSpecs: {
          subject: mail.subject,
          body: mail.text.slice(0, MAX_BODY_CHARS),
          measures: mail.measures as unknown as Prisma.InputJsonValue,
        },
        externalLinks: mail.links,
        files: {
          create: files.map((f) => ({
            filename: f.filename,
            storageKey: f.storageKey,
            sizeBytes: BigInt(f.size),
            mime: f.mime,
            checksum: f.checksum,
          })),
        },
        events: {
          create: {
            toStatus: status,
            note: status === "RECEIVED" ? "Ingreso por mail" : "Ingreso por mail: el remitente no tiene el alta aprobada",
          },
        },
      },
      select: { id: true },
    });
    jobId = job.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const dup = await prisma.jobOrder.findUniqueOrThrow({
      where: { sectorId_sourceMessageId: { sectorId: sector.id, sourceMessageId: mail.messageId } },
      select: { id: true },
    });
    await log(deps, sector, mail, "DUPLICATE", { jobId: dup.id });
    return { ...base, result: "DUPLICATE", jobId: dup.id };
  }

  const result: MailIngestResult = status === "RECEIVED" ? "CREATED" : "PENDING_SIGNUP";
  await log(deps, sector, mail, result, { jobId, fileCount: files.length });

  if (result === "PENDING_SIGNUP") await maybeInvite(deps, sector, customer.id, mail);

  return { ...base, result, jobId };
}

async function maybeInvite(deps: IngestDeps, sector: Sector, customerId: string, mail: ParsedMail) {
  const now = (deps.now ?? (() => new Date()))();
  // Se reserva el envío con un update condicional: dos mails seguidos no mandan dos invitaciones.
  const { count } = await deps.prisma.customer.updateMany({
    where: {
      id: customerId,
      OR: [{ signupInviteSentAt: null }, { signupInviteSentAt: { lt: new Date(now.getTime() - INVITE_COOLDOWN_MS) } }],
    },
    data: { signupInviteSentAt: now },
  });
  if (count === 0 || !mail.fromEmail) return;
  try {
    await deps.notifier.sendSignupInvite({ to: mail.fromEmail, sector, subject: mail.subject });
  } catch (err) {
    // Si el envío falla se libera la reserva para reintentar con el próximo mail.
    await deps.prisma.customer.update({ where: { id: customerId }, data: { signupInviteSentAt: null } });
    console.error(`[mail] no se pudo enviar el link de alta a ${mail.fromEmail}`, err);
  }
}

async function log(
  deps: IngestDeps,
  sector: Sector,
  mail: Partial<Pick<ParsedMail, "messageId" | "fromEmail" | "subject" | "sentAt">> & { messageId: string },
  result: MailIngestResult,
  extra: { jobId?: string; fileCount?: number; error?: string } = {},
) {
  await deps.prisma.mailIngestLog.create({
    data: {
      sectorId: sector.id,
      messageId: mail.messageId,
      fromEmail: mail.fromEmail ?? null,
      subject: mail.subject?.slice(0, 500) ?? null,
      sentAt: mail.sentAt ?? null,
      result,
      jobId: extra.jobId,
      fileCount: extra.fileCount ?? 0,
      error: extra.error?.slice(0, 2000),
    },
  });
}
