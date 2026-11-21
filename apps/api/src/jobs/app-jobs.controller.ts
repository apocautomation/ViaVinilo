import { Controller, Get, Injectable, NotFoundException, Param, ParseIntPipe } from "@nestjs/common";
import type { JobStatus, Prisma } from "@prisma/client";
import { formatBytes, formatJobNumber } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, type AuthCustomer } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";

/** Estados que nunca se le muestran al cliente como un paso del recorrido. */
const HIDDEN_STEPS = new Set<JobStatus>(["PENDING_SIGNUP", "FILE_ERROR", "CANCELLED"]);
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
      error: status === "FILE_ERROR" ? (lastError?.reason?.label ?? "Hay que corregir el archivo.") : null,
      files: job.files.map((f) => ({ name: f.filename, size: formatBytes(Number(f.sizeBytes)), available: f.purgedAt === null })),
      history: [...history].map(([s, at]) => ({ status: s, at })),
      channel: job.source === "EMAIL" ? "Mail" : job.source === "COUNTER" ? "Mostrador" : "App",
      createdAt: job.createdAt,
    };
  }

  async list(customerId: string) {
    const base = { customerId, deletedAt: null } as const;
    const [active, delivered] = await Promise.all([
      this.prisma.jobOrder.findMany({ where: { ...base, status: { notIn: ["DELIVERED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, include: jobInclude }),
      this.prisma.jobOrder.findMany({ where: { ...base, status: "DELIVERED" }, orderBy: { deliveredAt: "desc" }, take: DELIVERED_LIMIT, include: jobInclude }),
    ]);
    return { orders: [...active, ...delivered].map((j) => this.shape(j)) };
  }

  async one(customerId: string, number: number) {
    const job = await this.prisma.jobOrder.findFirst({ where: { number, customerId, deletedAt: null, status: { not: "CANCELLED" } }, include: jobInclude });
    // Mismo error si no existe o si es de otro cliente: no se revela cuál.
    if (!job) throw new NotFoundException("No encontramos ese pedido");
    return this.shape(job);
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
}
