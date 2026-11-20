import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { formatJobNumber, normalizeSearch, type MessageChannel } from "@viavinilo/contracts";
import { PrismaService } from "../prisma/prisma.service";

const PREVIEW_CHARS = 140;
const preview = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);

const customerSummary = {
  select: { id: true, customerNumber: true, firstName: true, lastName: true, businessName: true, status: true },
} satisfies Prisma.CustomerDefaultArgs;

/** Lo que el cliente ve de cada mensaje en la app: nunca quién del equipo respondió ni datos internos. */
const appMessageSelect = {
  id: true,
  direction: true,
  channel: true,
  subject: true,
  body: true,
  attachments: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

/**
 * Bandeja de Conversaciones (D-041, D-045): un hilo por cliente con el chat de la app y los mails
 * de las casillas de los sectores. El asesor responde por la app o por mail.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: { filter: "ALL" | "UNREAD" | "APP" | "MAIL"; search?: string; page: number; pageSize: number }) {
    const where: Prisma.ConversationWhereInput = {};
    if (q.filter === "UNREAD") where.staffUnread = { gt: 0 };
    if (q.filter === "APP" || q.filter === "MAIL") where.messages = { some: { channel: q.filter } };
    if (q.search) {
      const terms = normalizeSearch(q.search).split(" ").filter(Boolean);
      const digits = q.search.replace(/\D/g, "");
      where.OR = [
        { customer: { AND: terms.map((t) => ({ searchText: { contains: t } })) } },
        { customer: { emails: { some: { email: { contains: q.search.trim().toLowerCase() } } } } },
        { contactEmail: { contains: q.search.trim().toLowerCase() } },
        ...(digits && digits.length <= 9 && Number.isSafeInteger(Number(digits))
          ? [{ customer: { customerNumber: Number(digits) } }]
          : []),
      ];
    }
    const [total, items] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          customer: customerSummary,
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { channel: true, direction: true } },
        },
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map(({ messages, ...c }) => ({ ...c, lastChannel: messages[0]?.channel ?? null, lastDirection: messages[0]?.direction ?? null })),
    };
  }

  async get(id: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            ...customerSummary.select,
            appPasswordSetAt: true,
            emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true } },
            phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { phone: true } },
            internalNotes: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 300,
          include: {
            sector: { select: { code: true, name: true } },
            author: { select: { name: true } },
          },
        },
      },
    });
    if (!conv) throw new NotFoundException("No encontramos esa conversación");
    const jobs = conv.customerId
      ? await this.prisma.jobOrder.findMany({
          where: { customerId: conv.customerId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, number: true, status: true, description: true, quotedAmount: true, createdAt: true, sector: { select: { name: true } } },
        })
      : [];
    return {
      ...conv,
      jobs: jobs.map((j) => ({ ...j, label: formatJobNumber(j.number), quotedAmount: j.quotedAmount?.toString() ?? null })),
    };
  }

  async markRead(id: string) {
    await this.prisma.conversation.update({ where: { id }, data: { staffUnread: 0 } }).catch(() => {
      throw new NotFoundException("No encontramos esa conversación");
    });
    return { ok: true };
  }

  /**
   * El asesor responde (D-045):
   * - por la app: el cliente lo ve en la pestaña Chat;
   * - por mail: sale desde la casilla del sector del último mail del cliente y en el mismo hilo,
   *   o desde la casilla general si el cliente nunca escribió por mail.
   */
  async send(id: string, input: { text: string; channel: MessageChannel }, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { customer: { select: { id: true, status: true, emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } } } },
    });
    if (!conv) throw new NotFoundException("No encontramos esa conversación");

    if (input.channel === "APP") {
      if (!conv.customer || conv.customer.status !== "ACTIVE") {
        throw new UnprocessableEntityException("Solo un cliente activo puede ver mensajes en la app. Respondé por mail.");
      }
      return this.prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: { conversationId: id, direction: "OUT", channel: "APP", body: input.text, authorId: userId },
        });
        await tx.conversation.update({
          where: { id },
          data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(input.text), customerUnread: { increment: 1 }, staffUnread: 0 },
        });
        return msg;
      });
    }

    const lastMail = await this.prisma.message.findFirst({
      where: { conversationId: id, direction: "IN", channel: "MAIL" },
      orderBy: { createdAt: "desc" },
      include: { sector: { select: { id: true, inboxEmail: true } } },
    });
    const to = lastMail?.fromEmail ?? conv.customer?.emails[0]?.email ?? conv.contactEmail;
    if (!to) throw new UnprocessableEntityException("Este cliente no tiene email: respondé por la app o cargale un email.");
    const subject = lastMail?.subject ? (/^re:/i.test(lastMail.subject) ? lastMail.subject : `Re: ${lastMail.subject}`) : "Via Vinilo";

    return this.prisma.$transaction(async (tx) => {
      const out = await tx.outboundEmail.create({
        data: {
          to,
          subject,
          text: input.text,
          kind: "conversation-reply",
          customerId: conv.customerId,
          fromAddress: lastMail?.sector?.inboxEmail ?? null,
          inReplyToUid: lastMail?.mailUid ?? null,
        },
      });
      const msg = await tx.message.create({
        data: {
          conversationId: id,
          direction: "OUT",
          channel: "MAIL",
          sectorId: lastMail?.sector?.id ?? null,
          subject,
          body: input.text,
          authorId: userId,
          outboundEmailId: out.id,
        },
      });
      await tx.conversation.update({
        where: { id },
        data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(input.text), staffUnread: 0 },
      });
      return msg;
    });
  }

  // ───────────── Pestaña Chat de la app (cliente) ─────────────

  async customerThread(customerId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { customerId },
      select: { id: true, messages: { orderBy: { createdAt: "asc" }, take: 300, select: appMessageSelect } },
    });
    if (conv) await this.prisma.conversation.update({ where: { id: conv.id }, data: { customerUnread: 0 } });
    return { messages: conv?.messages ?? [] };
  }

  async customerUnread(customerId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { customerId }, select: { customerUnread: true } });
    return { unread: conv?.customerUnread ?? 0 };
  }

  async customerSend(customerId: string, text: string) {
    let conv = await this.prisma.conversation.findUnique({ where: { customerId }, select: { id: true } });
    if (!conv) {
      try {
        conv = await this.prisma.conversation.create({ data: { customerId }, select: { id: true } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
        conv = await this.prisma.conversation.findUniqueOrThrow({ where: { customerId }, select: { id: true } });
      }
    }
    const conversationId = conv.id;
    return this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { conversationId, direction: "IN", channel: "APP", body: text },
        select: appMessageSelect,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt, lastMessagePreview: preview(text), staffUnread: { increment: 1 } },
      });
      return msg;
    });
  }
}
