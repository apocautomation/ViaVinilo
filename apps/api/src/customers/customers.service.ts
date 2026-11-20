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
  type CustomerGap,
  type CustomerStatus,
  type NotificationPrefs,
  type TaxCondition,
} from "@viavinilo/contracts";
import { ActivationService } from "../app-auth/activation.service";
import { AuditService } from "../audit/audit.service";
import { hashPassword } from "../auth/password";
import { PrismaService } from "../prisma/prisma.service";

const include = {
  emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.CustomerInclude;

export type CustomerWithContacts = Prisma.CustomerGetPayload<{ include: typeof include }>;

/** Ficha del cliente más allá de identidad y contactos (D-038). */
interface ProfileInput {
  businessName?: string | null;
  cuit?: string | null;
  legalName?: string | null;
  taxCondition?: TaxCondition | null;
  fiscalAddress?: string | null;
  city?: string | null;
  province?: string | null;
  creditEnabled?: boolean;
  notificationPrefs?: NotificationPrefs;
}

interface CreateInput extends ProfileInput {
  firstName: string;
  lastName: string;
  dni: string;
  emails: string[];
  phones: string[];
  internalNotes?: string;
  isTrade?: boolean;
  /** Contraseña de la app en claro: se guarda solo el hash (D-039). */
  appPassword?: string;
}

interface UpdateInput extends ProfileInput {
  firstName?: string;
  lastName?: string;
  dni?: string;
  internalNotes?: string | null;
  isTrade?: boolean;
}

interface ListInput {
  search?: string;
  status?: CustomerStatus;
  gap?: CustomerGap;
  page: number;
  pageSize: number;
}

/** Traduce los choques de datos únicos a mensajes claros para el asesor. */
function uniqueConflict(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String((err.meta?.target as string[] | string | undefined) ?? "");
    if (target.includes("dni")) throw new ConflictException("Ya existe un cliente con ese DNI");
    if (target.includes("cuit")) throw new ConflictException("Ya existe un cliente con ese CUIT");
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
    private readonly activation: ActivationService,
  ) {}

  /**
   * Invitar a la app (D-049): a cada cliente activo con email le llega un link para crear su
   * contraseña. Con `allPending`, a todos los que tienen email y todavía no tienen contraseña.
   * Los mails salen de a poco desde la cola del worker. Devuelve cuántos se invitaron y por qué no
   * se pudo con el resto.
   */
  async invite(input: { customerIds?: string[]; allPending?: boolean }, userId: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(input.allPending ? { appPasswordSetAt: null, status: "ACTIVE" } : { id: { in: input.customerIds ?? [] } }),
      },
      select: {
        id: true,
        firstName: true,
        status: true,
        emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { email: true } },
      },
      take: 5000,
    });
    let invited = 0;
    let withoutEmail = 0;
    let notActive = 0;
    for (const c of customers) {
      const email = c.emails[0]?.email;
      if (c.status !== "ACTIVE") {
        notActive++;
        continue;
      }
      if (!email) {
        withoutEmail++;
        continue;
      }
      await this.activation.createAndQueue(c, email, "invite");
      await this.prisma.customer.update({ where: { id: c.id }, data: { appInvitedAt: new Date() } });
      await this.audit.log({ entity: "Customer", entityId: c.id, action: "app_invite", userId, after: { email } });
      invited++;
    }
    return { invited, withoutEmail, notActive };
  }

  async list({ search, status, gap, page, pageSize }: ListInput) {
    const where: Prisma.CustomerWhereInput = { deletedAt: null, ...(status ? { status } : {}) };
    // D-049: clientes con datos a completar.
    if (gap === "NO_EMAIL") where.emails = { none: {} };
    if (gap === "NO_DNI") where.dni = null;
    if (gap === "NO_APP_PASSWORD") where.appPasswordSetAt = null;

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
  async create({ appPassword, ...input }: CreateInput, userId: string) {
    const appPasswordHash = appPassword ? await hashPassword(appPassword) : undefined;
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
            businessName: input.businessName,
            cuit: input.cuit,
            legalName: input.legalName,
            taxCondition: input.taxCondition,
            fiscalAddress: input.fiscalAddress,
            city: input.city,
            province: input.province,
            creditEnabled: input.creditEnabled ?? false,
            notificationPrefs: input.notificationPrefs,
            appPasswordHash,
            appPasswordSetAt: appPasswordHash ? new Date() : undefined,
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

  /**
   * El asesor pone o cambia la contraseña de la app (D-039). En la auditoría queda que se cambió
   * y quién lo hizo, nunca la contraseña ni el hash. Las sesiones anteriores del cliente se cortan.
   */
  async setAppPassword(id: string, password: string, userId: string) {
    const customer = await this.get(id);
    const appPasswordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { appPasswordHash, appPasswordSetAt: new Date() } });
      await this.audit.log(
        { entity: "Customer", entityId: id, action: "set_app_password", userId, after: { hadPassword: customer.appPasswordSetAt !== null } },
        tx,
      );
    });
    return this.get(id);
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
    const approved = await this.changeStatus(customer, "ACTIVE", "approve", userId, {
      approvedAt: new Date(),
      approvedById: userId,
    });
    await this.releasePendingJobs(customer.id, userId);
    return approved;
  }

  /**
   * D-014: las órdenes que llegaron mientras el alta estaba pendiente pasan a "Archivo recibido"
   * y entran al tablero de su sector.
   */
  private async releasePendingJobs(customerId: string, userId: string) {
    const pending = await this.prisma.jobOrder.findMany({
      where: { customerId, status: "PENDING_SIGNUP", deletedAt: null },
      select: { id: true },
    });
    for (const job of pending) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.jobOrder.updateMany({
          where: { id: job.id, status: "PENDING_SIGNUP" },
          data: { status: "RECEIVED" },
        });
        if (count === 0) return;
        await tx.jobEvent.create({
          data: { jobId: job.id, fromStatus: "PENDING_SIGNUP", toStatus: "RECEIVED", userId, note: "Alta del cliente aprobada" },
        });
      });
    }
  }

  /**
   * D-054: un asesor rechaza un alta pendiente (datos falsos, no es del gremio, spam). Queda bloqueado
   * con el motivo: sus mails nuevos ya no crean pedidos y no puede entrar a la app.
   */
  async reject(id: string, reason: string, userId: string) {
    const customer = await this.get(id);
    if (customer.status !== "PENDING") throw new UnprocessableEntityException("Solo se pueden rechazar altas pendientes");
    return this.changeStatus(customer, "BLOCKED", "reject", userId, {}, reason);
  }

  /**
   * D-054: clientes que pueden ser la misma persona que un alta pendiente: mismo teléfono, mismo
   * nombre y apellido, o el número de cliente que dijo tener en el mail. Sirve para no duplicar a los
   * clientes importados de Runamatic que escriben desde un email nuevo.
   */
  async matches(id: string) {
    const customer = await this.get(id);
    const claimed = /Dice ser el cliente N\.º (\d+)/.exec(customer.internalNotes ?? "")?.[1];
    const or: Prisma.CustomerWhereInput[] = [];
    if (customer.phones.length) or.push({ phones: { some: { phone: { in: customer.phones.map((p) => p.phone) } } } });
    if (customer.searchText) or.push({ searchText: customer.searchText });
    if (claimed) or.push({ customerNumber: Number(claimed) });
    if (!or.length) return [];
    return this.prisma.customer.findMany({
      where: { id: { not: id }, deletedAt: null, OR: or },
      select: { id: true, customerNumber: true, firstName: true, lastName: true, businessName: true, status: true },
      orderBy: { customerNumber: "asc" },
      take: 10,
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
