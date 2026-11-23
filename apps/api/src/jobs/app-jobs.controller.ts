import { ConflictException, Controller, Get, HttpCode, Injectable, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { JobStatus, Prisma } from "@prisma/client";
import { alertSettingsSchema, formatBytes, formatJobNumber } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, type AuthCustomer } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";

/** Estados que nunca se le muestran al cliente como un paso del recorrido. */
const HIDDEN_STEPS = new Set<JobStatus>(["PENDING_SIGNUP", "FILE_ERROR", "CANCELLED"]);
/**
 * Hasta cuándo el cliente puede cancelar su pedido desde la app (D-074): mientras está en cotización
 * o antes. Con la seña pagada o ya impreso, no: tiene que hablar con un asesor.
 */
export const CUSTOMER_CANCELLABLE: JobStatus[] = ["PENDING_SIGNUP", "RECEIVED", "FILE_ERROR", "QUOTED"];
/** Cuántos pedidos entregados se listan (los más nuevos). */
const DELIVERED_LIMIT = 50;

const jobInclude = {
  sector: { select: { name: true, stages: { orderBy: { position: "asc" }, select: { status: true } } } },
  files: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { filename: true, sizeBytes: true, purgedAt: true } },
  events: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true, reason: { select: { label: true } } } },
} satisfies Prisma.JobOrderInclude;

type JobRow = Prisma.JobOrderGetPayload<{ include: typeof jobInclude }>;

/**
 * Lo que el cliente ve de sus pedidos en la app (contrato E1: "seguimiento automático en la app a
 * partir de los estados de producción"). Sale directo del tablero: mismo estado, medida, precio y
 * hora estimada. Nunca notas internas, ni quién lo movió, ni datos de otros clientes.
 */
@Injectable()
export class AppJobsService {
  constructor(private readonly prisma: PrismaService) {}

  private shape(job: JobRow) {
    // Mientras el alta del cliente está pendiente, para él el pedido está "recibido" (D-014).
    const status = job.status === "PENDING_SIGNUP" ? "RECEIVED" : job.status;
    const steps = job.sector.stages
      .map((s) => s.status)
      .filter((s) => !HIDDEN_STEPS.has(s) && (s !== "DEPOSIT_RECEIVED" || job.depositRequired));
    const lastError = [...job.events].reverse().find((e) => e.toStatus === "FILE_ERROR");
    // De cada estado, la última vez que el pedido pasó por ahí.
    const history = new Map<string, Date>();
    for (const e of job.events) history.set(e.toStatus === "PENDING_SIGNUP" ? "RECEIVED" : e.toStatus, e.createdAt);
    if (!history.has("RECEIVED")) history.set("RECEIVED", job.createdAt);
    return {
      id: String(job.number),
      num: formatJobNumber(job.number),
      sector: job.sector.name,
      desc: job.description ?? "",
      measure: job.measure ?? "",
      status,
      steps,
      amount: job.quotedAmount?.toString() ?? null,
      depositRequired: job.depositRequired,
      depositAmount: job.depositAmount?.toString() ?? null,
      depositPaid: job.depositPaidAt !== null,
      readyAt: job.estimatedReadyAt,
      canCancel: CUSTOMER_CANCELLABLE.includes(job.status),
      error: status === "FILE_ERROR" ? (lastError?.reason?.label ?? "Hay que corregir el archivo.") : null,
      files: job.files.map((f) => ({ name: f.filename, size: formatBytes(Number(f.sizeBytes)), available: f.purgedAt === null })),
      history: [...history].map(([s, at]) => ({ status: s, at })),
      channel: job.source === "EMAIL" ? "Mail" : job.source === "COUNTER" ? "Mostrador" : "App",
      createdAt: job.createdAt,
    };
  }

  /** Por defecto el cliente no ve sus pedidos cancelados; el dueño lo cambia en Configuración (D-073). */
  private async showCancelled(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: "alerts" } });
    const parsed = alertSettingsSchema.safeParse(row?.value);
    return parsed.success && parsed.data.showCancelledToCustomer;
  }

  async list(customerId: string) {
    const base = { customerId, deletedAt: null } as const;
    const closed: JobStatus[] = (await this.showCancelled()) ? ["DELIVERED", "CANCELLED"] : ["DELIVERED"];
    const [active, finished] = await Promise.all([
      this.prisma.jobOrder.findMany({ where: { ...base, status: { notIn: ["DELIVERED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, include: jobInclude }),
      this.prisma.jobOrder.findMany({ where: { ...base, status: { in: closed } }, orderBy: { updatedAt: "desc" }, take: DELIVERED_LIMIT, include: jobInclude }),
    ]);
    return { orders: [...active, ...finished].map((j) => this.shape(j)) };
  }

  async one(customerId: string, number: number) {
    const hidden: JobStatus[] = (await this.showCancelled()) ? [] : ["CANCELLED"];
    const job = await this.prisma.jobOrder.findFirst({ where: { number, customerId, deletedAt: null, status: { notIn: hidden } }, include: jobInclude });
    // Mismo error si no existe o si es de otro cliente: no se revela cuál.
    if (!job) throw new NotFoundException("No encontramos ese pedido");
    return this.shape(job);
  }

  /**
   * El cliente cancela su propio pedido (D-074). Solo si todavía no pasó de "Cotizado". Queda en el
   * historial del pedido y en la auditoría, y el equipo se entera por Conversaciones.
   */
  async cancel(customerId: string, number: number) {
    const job = await this.prisma.jobOrder.findFirst({ where: { number, customerId, deletedAt: null }, select: { id: true, status: true, number: true } });
    if (!job) throw new NotFoundException("No encontramos ese pedido");
    const tooLate = () => new ConflictException("Este pedido ya está en producción: para cancelarlo escribinos por el chat.");
    if (job.status === "CANCELLED") return { ok: true };
    if (!CUSTOMER_CANCELLABLE.includes(job.status)) throw tooLate();

    await this.prisma.$transaction(async (tx) => {
      // Solo si sigue en un estado cancelable: si justo lo imprimieron, no se pisa.
      const { count } = await tx.jobOrder.updateMany({ where: { id: job.id, status: { in: CUSTOMER_CANCELLABLE } }, data: { status: "CANCELLED" } });
      if (count === 0) throw tooLate();
      await tx.jobEvent.create({ data: { jobId: job.id, fromStatus: job.status, toStatus: "CANCELLED", note: "Cancelado por el cliente desde la app" } });
      await tx.auditLog.create({ data: { entity: "JobOrder", entityId: job.id, action: "customer_cancel", before: { status: job.status }, after: { status: "CANCELLED", customerId } } });
      // Aviso al equipo en Conversaciones, como un mensaje del cliente.
      const text = `Cancelé el pedido ${formatJobNumber(job.number)} desde la app.`;
      const conv =
        (await tx.conversation.findUnique({ where: { customerId }, select: { id: true } })) ?? (await tx.conversation.create({ data: { customerId }, select: { id: true } }));
      const msg = await tx.message.create({ data: { conversationId: conv.id, direction: "IN", channel: "APP", body: text, jobId: job.id } });
      await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.createdAt, lastMessagePreview: text, staffUnread: { increment: 1 } } });
    });
    return { ok: true };
  }
}

@Controller("app/jobs")
@CustomerAuth()
export class AppJobsController {
  constructor(private readonly jobs: AppJobsService) {}

  @Get()
  list(@CurrentCustomer() customer: AuthCustomer) {
    return this.jobs.list(customer.id);
  }

  @Get(":number")
  one(@Param("number", ParseIntPipe) number: number, @CurrentCustomer() customer: AuthCustomer) {
    return this.jobs.one(customer.id, number);
  }

  @Post(":number/cancel")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Param("number", ParseIntPipe) number: number, @CurrentCustomer() customer: AuthCustomer) {
    return this.jobs.cancel(customer.id, number);
  }
}
