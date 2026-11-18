import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  customerSearchText,
  missingFieldsForApproval,
  normalizeDni,
  normalizePhone,
  normalizeSearch,
  type CustomerStatus,
} from "@viavinilo/contracts";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

const include = {
  emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.CustomerInclude;

export type CustomerWithContacts = Prisma.CustomerGetPayload<{ include: typeof include }>;

interface CreateInput {
  firstName: string;
  lastName: string;
  dni: string;
  emails: string[];
  phones: string[];
  internalNotes?: string;
  isTrade?: boolean;
}

interface UpdateInput {
  firstName?: string;
  lastName?: string;
  dni?: string;
  internalNotes?: string | null;
  isTrade?: boolean;
}

interface ListInput {
  search?: string;
  status?: CustomerStatus;
  page: number;
  pageSize: number;
}

/** Traduce los choques de datos únicos a mensajes claros para el asesor. */
function uniqueConflict(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String((err.meta?.target as string[] | string | undefined) ?? "");
    if (target.includes("dni")) throw new ConflictException("Ya existe un cliente con ese DNI");
    if (target.includes("email")) throw new ConflictException("Ese email ya está cargado en otro cliente");
    if (target.includes("phone")) throw new ConflictException("Ese teléfono ya está cargado en otro cliente");
    throw new ConflictException("Ya existe un registro con esos datos");
  }
  throw err;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list({ search, status, page, pageSize }: ListInput) {
    const where: Prisma.CustomerWhereInput = { deletedAt: null, ...(status ? { status } : {}) };

    if (search) {
      // Nombre y apellido: cada palabra tiene que aparecer, sin importar tildes ni el orden.
      const terms = normalizeSearch(search).split(" ").filter(Boolean);
      const or: Prisma.CustomerWhereInput[] = [
        { AND: terms.map((t) => ({ searchText: { contains: t } })) },
        { emails: { some: { email: { contains: search.trim().toLowerCase() } } } },
      ];
      const digits = search.replace(/\D/g, "");
      if (digits.length > 0 && digits.length === search.replace(/[\s.\-+()]/g, "").length) {
        const n = Number(digits);
        if (Number.isSafeInteger(n) && digits.length <= 9) or.push({ customerNumber: n });
        or.push({ dni: { startsWith: normalizeDni(digits) } });
        or.push({ phones: { some: { phone: { contains: digits.slice(-8) } } } });
      }
      where.OR = or;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include,
        orderBy: { customerNumber: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async get(id: string): Promise<CustomerWithContacts> {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null }, include });
    if (!customer) throw new NotFoundException("No encontramos ese cliente");
    return customer;
  }

  /** Alta desde el backoffice: la hace un asesor, así que el cliente queda activo y aprobado por él. */
  async create(input: CreateInput, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            searchText: customerSearchText(input),
            dni: input.dni,
            internalNotes: input.internalNotes,
            isTrade: input.isTrade ?? true,
            status: "ACTIVE",
            approvedAt: new Date(),
            approvedById: userId,
            emails: {
              create: [...new Set(input.emails)].map((email, i) => ({ email, isPrimary: i === 0 })),
            },
            phones: {
              create: [...new Set(input.phones)].map((phone, i) => ({ phone, isPrimary: i === 0 })),
            },
          },
          include,
        });
        await this.audit.log(
          { entity: "Customer", entityId: created.id, action: "create", userId, after: created },
          tx,
        );
        return created;
      });
    } catch (err) {
      uniqueConflict(err);
    }
  }

  async update(id: string, input: UpdateInput, userId: string) {
    const before = await this.get(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const nameChanged = input.firstName !== undefined || input.lastName !== undefined;
        const searchText = nameChanged
          ? customerSearchText({
              firstName: input.firstName ?? before.firstName,
              lastName: input.lastName ?? before.lastName,
            })
          : undefined;
        const after = await tx.customer.update({ where: { id }, data: { ...input, searchText }, include });
        await this.audit.log({ entity: "Customer", entityId: id, action: "update", userId, before, after }, tx);
        return after;
      });
    } catch (err) {
      uniqueConflict(err);
    }
  }

  /** Un asesor aprueba un alta pendiente. Exige los datos mínimos de la actualización §2.1. */
  async approve(id: string, userId: string) {
    const customer = await this.get(id);
    if (customer.status !== "PENDING") {
      throw new UnprocessableEntityException("Solo se pueden aprobar altas pendientes");
    }
    const missing = missingFieldsForApproval({
      firstName: customer.firstName,
      lastName: customer.lastName,
      dni: customer.dni,
      emailCount: customer.emails.length,
      phoneCount: customer.phones.length,
    });
    if (missing.length) {
      throw new UnprocessableEntityException({
        message: `Para aprobar el alta falta: ${missing.join(", ")}`,
        missing,
      });
    }
    return this.changeStatus(customer, "ACTIVE", "approve", userId, {
      approvedAt: new Date(),
      approvedById: userId,
    });
  }

  async block(id: string, reason: string, userId: string) {
    const customer = await this.get(id);
    if (customer.status === "BLOCKED") throw new UnprocessableEntityException("El cliente ya está bloqueado");
    return this.changeStatus(customer, "BLOCKED", "block", userId, {}, reason);
  }

  async unblock(id: string, userId: string) {
    const customer = await this.get(id);
    if (customer.status !== "BLOCKED") throw new UnprocessableEntityException("El cliente no está bloqueado");
    return this.changeStatus(customer, "ACTIVE", "unblock", userId);
  }

  private changeStatus(
    before: CustomerWithContacts,
    status: CustomerStatus,
    action: string,
    userId: string,
    extra: Prisma.CustomerUncheckedUpdateInput = {},
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.customer.update({ where: { id: before.id }, data: { status, ...extra }, include });
      await this.audit.log(
        {
          entity: "Customer",
          entityId: before.id,
          action,
          userId,
          before: { status: before.status },
          after: { status, ...(reason ? { reason } : {}) },
        },
        tx,
      );
      return after;
    });
  }

  /**
   * Baja lógica. Se borran sus emails y teléfonos para que se puedan volver a usar en otro alta;
   * quedan guardados en el log de auditoría.
   */
  async remove(id: string, userId: string) {
    const before = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerEmail.deleteMany({ where: { customerId: id } });
      await tx.customerPhone.deleteMany({ where: { customerId: id } });
      await tx.customer.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.log({ entity: "Customer", entityId: id, action: "delete", userId, before }, tx);
    });
  }

  // ── Emails y teléfonos ──

  async addEmail(id: string, email: string, isPrimary: boolean | undefined, userId: string) {
    const customer = await this.get(id);
    const makePrimary = isPrimary || customer.emails.length === 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (makePrimary) await tx.customerEmail.updateMany({ where: { customerId: id }, data: { isPrimary: false } });
        await tx.customerEmail.create({ data: { customerId: id, email, isPrimary: makePrimary } });
        await this.audit.log({ entity: "Customer", entityId: id, action: "add_email", userId, after: { email } }, tx);
      });
    } catch (err) {
      uniqueConflict(err);
    }
    return this.get(id);
  }

  async removeEmail(id: string, emailId: string, userId: string) {
    const customer = await this.get(id);
    const target = customer.emails.find((e) => e.id === emailId);
    if (!target) throw new NotFoundException("Ese email no es de este cliente");
    if (customer.status === "ACTIVE" && customer.emails.length === 1) {
      throw new UnprocessableEntityException("Un cliente activo tiene que tener al menos un email");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customerEmail.delete({ where: { id: emailId } });
      const next = customer.emails.find((e) => e.id !== emailId);
      if (target.isPrimary && next) await tx.customerEmail.update({ where: { id: next.id }, data: { isPrimary: true } });
      await this.audit.log(
        { entity: "Customer", entityId: id, action: "remove_email", userId, before: { email: target.email } },
        tx,
      );
    });
    return this.get(id);
  }

  async addPhone(id: string, phone: string, isPrimary: boolean | undefined, userId: string) {
    const customer = await this.get(id);
    const normalized = normalizePhone(phone) ?? phone;
    const makePrimary = isPrimary || customer.phones.length === 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (makePrimary) await tx.customerPhone.updateMany({ where: { customerId: id }, data: { isPrimary: false } });
        await tx.customerPhone.create({ data: { customerId: id, phone: normalized, isPrimary: makePrimary } });
        await this.audit.log(
          { entity: "Customer", entityId: id, action: "add_phone", userId, after: { phone: normalized } },
          tx,
        );
      });
    } catch (err) {
      uniqueConflict(err);
    }
    return this.get(id);
  }

  async removePhone(id: string, phoneId: string, userId: string) {
    const customer = await this.get(id);
    const target = customer.phones.find((p) => p.id === phoneId);
    if (!target) throw new NotFoundException("Ese teléfono no es de este cliente");
    if (customer.status === "ACTIVE" && customer.phones.length === 1) {
      throw new UnprocessableEntityException("Un cliente activo tiene que tener al menos un teléfono");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customerPhone.delete({ where: { id: phoneId } });
      const next = customer.phones.find((p) => p.id !== phoneId);
      if (target.isPrimary && next) await tx.customerPhone.update({ where: { id: next.id }, data: { isPrimary: true } });
      await this.audit.log(
        { entity: "Customer", entityId: id, action: "remove_phone", userId, before: { phone: target.phone } },
        tx,
      );
    });
    return this.get(id);
  }
}
