import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  attachmentsOf,
  formatJobNumber,
  isAllowedFile,
  MAX_FILES_PER_MESSAGE,
  MAX_MAIL_ATTACHMENTS_BYTES,
  MAX_UPLOAD_BYTES,
  safeFileName,
  type MessageAttachment,
  type MessageChannel,
  type SectorCode,
} from "@viavinilo/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../files/storage.service";
import { ConversationsService } from "./conversations.service";

/** Lo que entrega multer con el archivo en memoria (no se usan los tipos de @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const PREVIEW_CHARS = 140;
const preview = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

/** El nombre llega en latin1 desde multer: se pasa a UTF-8 para no romper tildes ("DiseÃ±o"). */
const originalName = (f: UploadedFileLike) => safeFileName(Buffer.from(f.originalname, "latin1").toString("utf8"));

/**
 * Archivos en Conversaciones (D-062).
 * - El cliente manda su archivo por el chat de la app: se guarda y se crea el pedido en el tablero
 *   del servicio que eligió, en "Archivo recibido", igual que si lo hubiera mandado por mail.
 * - El asesor adjunta archivos al responder: por la app (el cliente los descarga) o por mail.
 */
@Injectable()
export class ConversationFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly conversations: ConversationsService,
  ) {}

  private check(file: UploadedFileLike | undefined): asserts file is UploadedFileLike {
    if (!file) throw new BadRequestException("Elegí un archivo");
    const name = originalName(file);
    if (!isAllowedFile(name)) {
      throw new UnprocessableEntityException("Ese tipo de archivo no se acepta. Mandá PDF, PNG, JPG, TIF, AI, EPS, PSD, CDR, SVG o ZIP.");
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new UnprocessableEntityException("El archivo es muy grande: el máximo es 150 MB.");
  }

  private async store(prefix: string, file: UploadedFileLike): Promise<MessageAttachment & { checksum: string }> {
    const name = originalName(file);
    const key = `${prefix}/${randomUUID()}/${name}`;
    await this.storage.put(key, file.buffer);
    return {
      name,
      key,
      size: file.size,
      mime: file.mimetype || "application/octet-stream",
      checksum: createHash("sha256").update(file.buffer).digest("hex"),
    };
  }

  private async conversationOf(customerId: string): Promise<string> {
    const found = await this.prisma.conversation.findUnique({ where: { customerId }, select: { id: true } });
    if (found) return found.id;
    try {
      return (await this.prisma.conversation.create({ data: { customerId }, select: { id: true } })).id;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      return (await this.prisma.conversation.findUniqueOrThrow({ where: { customerId }, select: { id: true } })).id;
    }
  }

  // ───────────── Cliente (app) ─────────────

  async customerUpload(customerId: string, file: UploadedFileLike | undefined, input: { sector: SectorCode; note?: string }) {
    this.check(file);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { status: true, deletedAt: true } });
    if (!customer || customer.deletedAt) throw new NotFoundException("No encontramos tu cuenta");
    if (customer.status === "BLOCKED") throw new ForbiddenException("Tu cuenta no puede enviar trabajos. Escribinos por el chat.");
    const sector = await this.prisma.sector.findUnique({ where: { code: input.sector } });
    if (!sector) throw new BadRequestException("Elegí un servicio");

    const conversationId = await this.conversationOf(customerId);
    const stored = await this.store(`app/${customerId}`, file);
    const { checksum, ...attachment } = stored;
    const note = input.note?.trim() || null;

    // D-065: con un solo pedido en "Archivo con error" en este tablero, es el archivo corregido.
    const errored = await this.prisma.jobOrder.findMany({
      where: { customerId, sectorId: sector.id, status: "FILE_ERROR", deletedAt: null },
      select: { id: true, number: true },
      take: 2,
    });
    if (errored.length === 1) {
      const target = errored[0]!;
      return this.prisma.$transaction(async (tx) => {
        await tx.jobFile.create({
          data: { jobId: target.id, filename: attachment.name, storageKey: attachment.key!, sizeBytes: BigInt(attachment.size!), mime: attachment.mime!, checksum },
        });
        await tx.jobOrder.update({ where: { id: target.id }, data: { status: "RECEIVED", fileCheck: Prisma.DbNull, ...(note ? { requestedSpecs: { channel: "app", note } } : {}) } });
        await tx.jobEvent.create({ data: { jobId: target.id, fromStatus: "FILE_ERROR", toStatus: "RECEIVED", note: "El cliente mandó el archivo corregido por la app" } });
        const msg = await tx.message.create({
          data: { conversationId, direction: "IN", channel: "APP", body: note ?? "Te mando el archivo corregido.", attachments: [attachment] as unknown as Prisma.InputJsonValue, jobId: target.id },
          select: { id: true, direction: true, channel: true, subject: true, body: true, attachments: true, createdAt: true, fromBot: true, jobId: true },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(`📎 ${attachment.name}`), staffUnread: { increment: 1 } },
        });
        return { message: msg, job: { id: target.id, label: formatJobNumber(target.number), sector: sector.name }, resent: true };
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobOrder.create({
        data: {
          customerId,
          sectorId: sector.id,
          status: "RECEIVED",
          source: "API",
          sourceMessageId: `app:${attachment.key}`,
          description: (note ?? attachment.name).slice(0, 200),
          requestedSpecs: { channel: "app", note },
          files: {
            create: { filename: attachment.name, storageKey: attachment.key!, sizeBytes: BigInt(attachment.size!), mime: attachment.mime!, checksum },
          },
          events: { create: { toStatus: "RECEIVED", note: "Ingreso por la app" } },
        },
        select: { id: true, number: true },
      });
      const body = note ?? `Te mando el archivo para ${sector.name}.`;
      const msg = await tx.message.create({
        data: { conversationId, direction: "IN", channel: "APP", body, attachments: [attachment] as unknown as Prisma.InputJsonValue, jobId: job.id },
        select: { id: true, direction: true, channel: true, subject: true, body: true, attachments: true, createdAt: true, fromBot: true, jobId: true },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(`📎 ${attachment.name}`), staffUnread: { increment: 1 } },
      });
      return { message: msg, job: { id: job.id, label: formatJobNumber(job.number), sector: sector.name } };
    });
  }

  async customerFile(customerId: string, messageId: string, index: number) {
    const msg = await this.prisma.message.findFirst({ where: { id: messageId, conversation: { customerId } }, select: { attachments: true } });
    return this.streamOf(msg?.attachments, index);
  }

  // ───────────── Asesor (ERP) ─────────────

  async staffUpload(conversationId: string, files: UploadedFileLike[], input: { text?: string; channel: MessageChannel }, userId: string) {
    if (!files.length) throw new BadRequestException("Elegí al menos un archivo");
    if (files.length > MAX_FILES_PER_MESSAGE) throw new UnprocessableEntityException(`Máximo ${MAX_FILES_PER_MESSAGE} archivos por mensaje`);
    files.forEach((f) => this.check(f));
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (input.channel === "MAIL" && total > MAX_MAIL_ATTACHMENTS_BYTES) {
      throw new UnprocessableEntityException("Por mail entran hasta 20 MB de adjuntos. Mandalo por la app o en partes.");
    }
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
    if (!conv) throw new NotFoundException("No encontramos esa conversación");
    const attachments: MessageAttachment[] = [];
    for (const f of files) {
      const stored = await this.store(`conversations/${conversationId}`, f);
      attachments.push({ name: stored.name, key: stored.key, size: stored.size, mime: stored.mime });
    }
    const names = attachments.map((a) => a.name).join(", ");
    return this.conversations.send(conversationId, { text: input.text?.trim() || `Te mando ${attachments.length === 1 ? "el archivo" : "los archivos"}: ${names}`, channel: input.channel }, userId, attachments);
  }

  async staffFile(conversationId: string, messageId: string, index: number) {
    const msg = await this.prisma.message.findFirst({ where: { id: messageId, conversationId }, select: { attachments: true } });
    return this.streamOf(msg?.attachments, index);
  }

  private async streamOf(value: unknown, index: number): Promise<StreamableFile> {
    const a = attachmentsOf(value)[index];
    if (!a?.key) throw new NotFoundException("No encontramos ese archivo");
    const { stream, size } = await this.storage.open(a.key);
    return new StreamableFile(stream, {
      type: a.mime ?? "application/octet-stream",
      length: size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    });
  }
}
