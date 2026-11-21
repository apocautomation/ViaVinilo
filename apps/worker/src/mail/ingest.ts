import { createHash } from "node:crypto";
import { Prisma, type MailIngestResult, type PrismaClient, type Sector } from "@prisma/client";
import type { FileStorage } from "../storage";
import { customerSearchText, isResetCommand, RESET_REPLY } from "@viavinilo/contracts";
import { extractContact } from "./contact";
import { recordInboundMail } from "./conversation";
import { parseMail, type ParsedMail } from "./parse";

/** Avisos que dispara la ingesta. En producción manda mails por SMTP (invite.ts). */
export interface IngestNotifier {
  /** Mail a un remitente que todavía no es cliente activo: le dice que escriba por WhatsApp (D-014, D-038). */
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

/** No se reenvía el mail de alta más de una vez por día al mismo remitente. */
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
export async function ingestMail(
  deps: IngestDeps,
  sector: Sector,
  raw: Buffer,
  meta: { uid?: number } = {},
): Promise<IngestOutcome> {
  let mail: ParsedMail;
  try {
    mail = await parseMail(raw);
  } catch (err) {
    const messageId = `<unparseable-${createHash("sha256").update(raw).digest("hex")}@viavinilo.local>`;
    const error = err instanceof Error ? err.message : String(err);
    await log(deps, sector, { messageId }, "ERROR", { error });
    return { result: "ERROR", messageId, error };
  }

  const outcome = await decide(deps, sector, mail, meta);
  await deps.prisma.mailboxState.upsert({
    where: { sectorId: sector.id },
    update: { lastMessageAt: (deps.now ?? (() => new Date()))() },
    create: { sectorId: sector.id, lastMessageAt: (deps.now ?? (() => new Date()))() },
  });
  return outcome;
}

async function decide(
  deps: IngestDeps,
  sector: Sector,
  received: ParsedMail,
  meta: { uid?: number },
): Promise<IngestOutcome> {
  const { prisma } = deps;
  const base = { messageId: received.messageId };
  // D-057: un reenvío desde una casilla nuestra es del cliente que escribió el mail original.
  const own = await isOwnMailbox(prisma, received.fromEmail);
  const original = own ? forwardedSender(received.text, await ownDomains(prisma)) : null;
  const mail: ParsedMail = original ? { ...received, fromEmail: original.email, fromName: original.name } : received;
  /** D-045: todo mail de una persona queda en su hilo de Conversaciones, cree o no una orden. */
  const toInbox = (customerId: string | null, jobId?: string) =>
    recordInboundMail(prisma, { sector, mail, customerId, jobId, uid: meta.uid, senderEmail: received.fromEmail });
  const knownCustomerId = async () => {
    if (!mail.fromEmail) return null;
    const c = await prisma.customerEmail.findUnique({ where: { email: mail.fromEmail }, select: { customer: { select: { id: true, deletedAt: true } } } });
    return c && !c.customer.deletedAt ? c.customer.id : null;
  };

  if (own && !original) {
    // Un mail del equipo sin el remitente original: queda en Conversaciones, sin crear cliente ni pedido.
    await toInbox(null);
    const error = "Mail de una casilla de Via Vinilo sin el remitente original: cargá el pedido a mano";
    await log(deps, sector, received, "ERROR", { error });
    return { ...base, result: "ERROR", error };
  }

  // D-061: "/reset" por mail borra la memoria del bot con ese cliente y se le responde en el mismo hilo.
  if (isResetCommand(mail.text) && mail.files.length === 0) {
    const customerId = await knownCustomerId();
    await toInbox(customerId);
    if (customerId && mail.fromEmail) {
      const conv = await prisma.conversation.findUnique({ where: { customerId }, select: { id: true } });
      if (conv) {
        const subject = mail.subject ? (/^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`) : "Via Vinilo";
        await prisma.$transaction(async (tx) => {
          const out = await tx.outboundEmail.create({
            data: { to: mail.fromEmail!, subject, text: RESET_REPLY, kind: "bot-reset", customerId, fromAddress: sector.inboxEmail, inReplyToUid: meta.uid ?? null },
          });
          const at = new Date();
          await tx.message.create({
            data: { conversationId: conv.id, direction: "OUT", channel: "MAIL", sectorId: sector.id, subject, body: RESET_REPLY, fromBot: true, outboundEmailId: out.id, createdAt: at },
          });
          await tx.conversation.update({ where: { id: conv.id }, data: { botResetAt: at, needsHuman: false, needsHumanReason: null, lastMessageAt: at, lastMessagePreview: RESET_REPLY } });
        });
      }
    }
    await log(deps, sector, received, "COMMAND");
    return { ...base, result: "COMMAND" };
  }

  if (mail.isAutoReply) {
    await log(deps, sector, received, "SKIPPED_AUTO_REPLY");
    return { ...base, result: "SKIPPED_AUTO_REPLY" };
  }

  const existing = await prisma.jobOrder.findUnique({
    where: { sectorId_sourceMessageId: { sectorId: sector.id, sourceMessageId: mail.messageId } },
    select: { id: true },
  });
  if (existing) {
    await log(deps, sector, received, "DUPLICATE", { jobId: existing.id });
    return { ...base, result: "DUPLICATE", jobId: existing.id };
  }

  if (mail.files.length === 0 && mail.links.length === 0) {
    // Sin archivo no se crea orden (I-15), pero el mail no se pierde: va a Conversaciones (D-045).
    await toInbox(await knownCustomerId());
    await log(deps, sector, received, "SKIPPED_NO_FILES");
    return { ...base, result: "SKIPPED_NO_FILES" };
  }

  if (!mail.fromEmail) {
    const error = "El mail no tiene remitente";
    await log(deps, sector, received, "ERROR", { error });
    return { ...base, result: "ERROR", error };
  }

  // Cliente por email del remitente; si no existe se crea con alta pendiente (D-014).
  const contact = await prisma.customerEmail.findUnique({
    where: { email: mail.fromEmail },
    include: { customer: true },
  });
  let customer = contact?.customer.deletedAt ? null : (contact?.customer ?? null);

  if (customer?.status === "BLOCKED") {
    await toInbox(customer.id);
    await log(deps, sector, received, "REJECTED_BLOCKED");
    return { ...base, result: "REJECTED_BLOCKED" };
  }

  if (!customer) {
    // D-054: el alta queda pendiente, con los datos que el cliente escribió en el mail.
    const found = extractContact(mail.text, mail.fromName);
    const phoneFree = found.phone && !(await prisma.customerPhone.findUnique({ where: { phone: found.phone } }));
    try {
      customer = await prisma.customer.create({
        data: {
          status: "PENDING",
          firstName: found.firstName,
          lastName: found.lastName,
          searchText: customerSearchText(found),
          internalNotes: signupNotes(mail.fromName, found),
          emails: { create: { email: mail.fromEmail, isPrimary: true } },
          ...(phoneFree ? { phones: { create: { phone: found.phone!, isPrimary: true } } } : {}),
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

  if (customer.status === "PENDING" && !customer.firstName) customer = await fillPendingContact(prisma, customer.id, mail);

  // D-054: el alta pendiente es solo una formalidad: el pedido entra igual al tablero.
  const pendingSignup = customer.status === "PENDING";
  const status = "RECEIVED" as const;

  // Los archivos se guardan antes de crear la orden, con una clave estable por mail: si la orden
  // ya existe (reintento), solo se sobrescriben con el mismo contenido.
  const folder = `mail/${sector.code.toLowerCase()}/${createHash("sha256").update(mail.messageId).digest("hex").slice(0, 32)}`;
  const files = mail.files.map((f, i) => ({ ...f, storageKey: `${folder}/${i + 1}-${f.filename}` }));
  for (const f of files) await deps.storage.put(f.storageKey, f.content);

  // D-065: un mail de reenvío leído dos veces: sus archivos ya están en un pedido. No se repite.
  const already = files.length ? await prisma.jobFile.findUnique({ where: { storageKey: files[0]!.storageKey }, select: { jobId: true } }) : null;
  if (already) {
    await log(deps, sector, received, "DUPLICATE", { jobId: already.jobId });
    return { ...base, result: "DUPLICATE", jobId: already.jobId };
  }

  // D-065: si el cliente tiene un solo pedido en "Archivo con error" en este tablero, este mail es el
  // archivo corregido: se suma a ese pedido y vuelve a "Archivo recibido" (no se crea otro).
  const errored = files.length
    ? await prisma.jobOrder.findMany({ where: { customerId: customer.id, sectorId: sector.id, status: "FILE_ERROR", deletedAt: null }, select: { id: true }, take: 2 })
    : [];
  if (errored.length === 1) {
    const target = errored[0]!.id;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.jobFile.createMany({
          data: files.map((f) => ({ jobId: target, filename: f.filename, storageKey: f.storageKey, sizeBytes: BigInt(f.size), mime: f.mime, checksum: f.checksum })),
        });
        await tx.jobOrder.update({ where: { id: target }, data: { status: "RECEIVED", fileCheck: Prisma.DbNull } });
        await tx.jobEvent.create({ data: { jobId: target, fromStatus: "FILE_ERROR", toStatus: "RECEIVED", note: "El cliente mandó el archivo corregido por mail" } });
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // El mismo mail leído dos veces: los archivos ya estaban sumados.
      await log(deps, sector, received, "DUPLICATE", { jobId: target });
      return { ...base, result: "DUPLICATE", jobId: target };
    }
    await toInbox(customer.id, target);
    await log(deps, sector, received, "RESENT", { jobId: target, fileCount: files.length });
    return { ...base, result: "RESENT", jobId: target };
  }

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
            note: pendingSignup ? "Ingreso por mail (cliente con alta pendiente de aprobación)" : "Ingreso por mail",
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
    await log(deps, sector, received, "DUPLICATE", { jobId: dup.id });
    return { ...base, result: "DUPLICATE", jobId: dup.id };
  }

  const result: MailIngestResult = pendingSignup ? "PENDING_SIGNUP" : "CREATED";
  await toInbox(customer.id, jobId);
  await log(deps, sector, received, result, { jobId, fileCount: files.length });

  if (result === "PENDING_SIGNUP") await maybeInvite(deps, sector, customer.id, mail);

  return { ...base, result, jobId };
}

/**
 * D-054: un alta pendiente que todavía no tiene nombre lo toma del próximo mail que lo traiga.
 * Nunca pisa lo que ya cargó un asesor. También se usa para completar las altas viejas.
 */
export async function fillPendingContact(prisma: PrismaClient, customerId: string, mail: Pick<ParsedMail, "text" | "fromName">) {
  const found = extractContact(mail.text, mail.fromName);
  const current = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, include: { phones: true } });
  if (current.status !== "PENDING" || current.firstName || !found.firstName) return current;
  const phoneFree =
    found.phone && current.phones.length === 0 && !(await prisma.customerPhone.findUnique({ where: { phone: found.phone } }));
  const extra = signupNotes(null, found);
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: found.firstName,
      lastName: current.lastName ?? found.lastName,
      searchText: customerSearchText({ firstName: found.firstName, lastName: current.lastName ?? found.lastName }),
      ...(extra ? { internalNotes: [current.internalNotes, extra].filter(Boolean).join("\n") } : {}),
      ...(phoneFree ? { phones: { create: { phone: found.phone!, isPrimary: true } } } : {}),
    },
  });
}

/** Dominios de las casillas de los sectores (ej. "viavinilo.com"). */
async function ownDomains(prisma: PrismaClient): Promise<Set<string>> {
  const sectors = await prisma.sector.findMany({ select: { inboxEmail: true } });
  return new Set(sectors.map((x) => x.inboxEmail?.split("@")[1]?.toLowerCase()).filter((d): d is string => Boolean(d)));
}

async function isOwnMailbox(prisma: PrismaClient, email: string | null): Promise<boolean> {
  const domain = email?.split("@")[1]?.toLowerCase();
  return Boolean(domain && (await ownDomains(prisma)).has(domain));
}

/**
 * D-057: en un reenvío ("RV:", "Fwd:") el remitente original está en el encabezado citado
 * ("De: Lucía Pérez <lucia@gmail.com>"). Se toma el primero que no sea una casilla nuestra.
 */
export function forwardedSender(text: string, own: Set<string>): { email: string; name: string | null } | null {
  for (const m of text.matchAll(/^[\s>*]*(?:De|From)\s*:\s*(.+)$/gim)) {
    const value = m[1]!.trim();
    const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(value)?.[0]?.toLowerCase();
    if (!email || own.has(email.split("@")[1]!)) continue;
    const name = value.replace(/<[^>]*>/, "").replace(email, "").replace(/["'[\]()]/g, "").trim();
    return { email, name: name || null };
  }
  return null;
}

function signupNotes(fromName: string | null, c: ReturnType<typeof extractContact>): string | null {
  const lines = [
    fromName ? `Nombre en el mail: ${fromName}` : null,
    c.claimedCustomerNumber ? `Dice ser el cliente N.º ${c.claimedCustomerNumber}` : null,
    c.pickup ? `Retira en: ${c.pickup}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
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
    console.error(`[mail] no se pudo enviar el mail de alta a ${mail.fromEmail}`, err);
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
