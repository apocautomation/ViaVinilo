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
  type PickupBranch,
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
/** Pasos en los que el cliente todavía puede sumar o cambiar el archivo de un pedido (D-094): antes de imprimir. */
const FILE_OPEN_STATUSES: string[] = ["PENDING_SIGNUP", "RECEIVED", "FILE_ERROR", "QUOTED", "DEPOSIT_RECEIVED"];

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

  async customerUpload(customerId: string, file: UploadedFileLike | undefined, input: { sector?: SectorCode; job?: number; variant?: string; note?: string; pickupBranch?: PickupBranch; widthCm?: number; heightCm?: number; copies?: number }) {
    this.check(file);
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { status: true, deletedAt: true } });
    if (!customer || customer.deletedAt) throw new NotFoundException("No encontramos tu cuenta");
    if (customer.status === "BLOCKED") throw new ForbiddenException("Tu cuenta no puede enviar trabajos. Escribinos por el chat.");
    // D-094: el archivo puede ser para un pedido que el cliente ya tiene (corregido o que faltaba).
    const chosen = input.job
      ? await this.prisma.jobOrder.findFirst({ where: { number: input.job, customerId, deletedAt: null }, select: { id: true, number: true, status: true, requestedSpecs: true, sector: true } })
      : null;
    if (input.job && !chosen) throw new NotFoundException("No encontramos ese pedido");
    if (chosen && !FILE_OPEN_STATUSES.includes(chosen.status)) {
      throw new UnprocessableEntityException("Ese pedido ya está en producción: no se le puede cambiar el archivo. Escribinos por este chat y lo vemos.");
    }
    const sector = chosen?.sector ?? (input.sector ? await this.prisma.sector.findUnique({ where: { code: input.sector } }) : null);
    if (!sector) throw new BadRequestException("Elegí un servicio");
    // D-095: el material tiene que ser de ese servicio y estar activo.
    const variant = !chosen && input.variant ? await this.prisma.sectorVariant.findFirst({ where: { id: input.variant, sectorId: sector.id, active: true }, select: { id: true, name: true } }) : null;
    if (!chosen && input.variant && !variant) throw new BadRequestException("Ese material no es de este servicio");

    const conversationId = await this.conversationOf(customerId);
    const stored = await this.store(`app/${customerId}`, file);
    const { checksum, ...attachment } = stored;
    const note = input.note?.trim() || null;
    // D-087: el formulario de "Enviar" manda la medida y las copias en campos propios.
    const cm = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
    const measure = input.widthCm && input.heightCm ? `${cm(input.widthCm)} x ${cm(input.heightCm)} cm` : null;
    const copies = input.copies ? `${input.copies} ${input.copies === 1 ? "copia" : "copias"}` : null;
    const summary = [measure, copies].filter(Boolean).join(" · ");
    const materialLine = () => (variant ? `Material: ${variant.name}` : "");
    const specs = {
      channel: "app",
      note,
      ...(measure ? { measures: [{ raw: measure, widthCm: input.widthCm, heightCm: input.heightCm }] } : {}),
      ...(input.copies ? { copies: input.copies } : {}),
    };

    // D-065: con un solo pedido en "Archivo con error" en este tablero, es el archivo corregido.
    const errored = chosen
      ? []
      : await this.prisma.jobOrder.findMany({
          where: { customerId, sectorId: sector.id, status: "FILE_ERROR", deletedAt: null },
          select: { id: true, number: true, status: true, requestedSpecs: true },
          take: 2,
        });
    const target = chosen ?? (errored.length === 1 ? errored[0]! : null);
    if (target) {
      const wasError = target.status === "FILE_ERROR";
      // La nota se suma a lo que ya había: antes pisaba las medidas del pedido.
      const prev = (target.requestedSpecs as Record<string, unknown> | null) ?? {};
      const nextSpecs = note ? { ...prev, note: [prev.note, note].filter(Boolean).join("\n") } : null;
      return this.prisma.$transaction(async (tx) => {
        await tx.jobFile.create({
          data: { jobId: target.id, filename: attachment.name, storageKey: attachment.key!, sizeBytes: BigInt(attachment.size!), mime: attachment.mime!, checksum },
        });
        await tx.jobOrder.update({
          where: { id: target.id },
          data: {
            ...(wasError ? { status: "RECEIVED" } : {}),
            // Con un archivo nuevo, el control automático se hace otra vez.
            ...(wasError || target.status === "RECEIVED" ? { fileCheck: Prisma.DbNull } : {}),
            ...(nextSpecs ? { requestedSpecs: nextSpecs as Prisma.InputJsonValue } : {}),
          },
        });
        await tx.jobEvent.create({
          data: wasError
            ? { jobId: target.id, fromStatus: "FILE_ERROR", toStatus: "RECEIVED", note: "El cliente mandó el archivo corregido por la app" }
            : // El pedido no cambia de paso: queda en el historial y no dispara un aviso de estado.
              { jobId: target.id, fromStatus: target.status, toStatus: target.status, note: `El cliente sumó un archivo por la app: ${attachment.name}`, notifiedCustomer: true },
        });
        const msg = await tx.message.create({
          data: {
            conversationId,
            direction: "IN",
            channel: "APP",
            body: note ?? (wasError ? "Te mando el archivo corregido." : `Te mando un archivo para el pedido ${formatJobNumber(target.number)}.`),
            attachments: [attachment] as unknown as Prisma.InputJsonValue,
            jobId: target.id,
          },
          select: { id: true, direction: true, channel: true, subject: true, body: true, attachments: true, createdAt: true, fromBot: true, jobId: true },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(`📎 ${attachment.name}`), staffUnread: { increment: 1 } },
        });
        return { message: msg, job: { id: target.id, label: formatJobNumber(target.number), sector: sector.name }, resent: wasError, added: !wasError };
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobOrder.create({
        data: {
          customerId,
          sectorId: sector.id,
          status: "RECEIVED",
          source: "API",
          pickupBranch: input.pickupBranch ?? null,
          variantId: variant?.id ?? null,
          sourceMessageId: `app:${attachment.key}`,
          description: ([summary, note].filter(Boolean).join(" · ") || attachment.name).replace(/\s*\n\s*/g, " · ").slice(0, 200),
          measure,
          requestedSpecs: specs,
          files: {
            create: { filename: attachment.name, storageKey: attachment.key!, sizeBytes: BigInt(attachment.size!), mime: attachment.mime!, checksum },
          },
          events: { create: { toStatus: "RECEIVED", note: "Ingreso por la app" } },
        },
        select: { id: true, number: true },
      });
      const body = [materialLine(), summary ? `Medida y cantidad: ${summary}` : "", note ?? (summary ? "" : `Te mando el archivo para ${sector.name}.`)].filter(Boolean).join("\n");
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
