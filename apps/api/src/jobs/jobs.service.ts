import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, type JobStatus, type SectorCode } from "@prisma/client";
import {
  JOB_STATUS_LABELS,
  allowedTransitions,
  checkTransition,
  formatJobNumber,
  normalizeSearch,
  parseJobNumber,
} from "@viavinilo/contracts";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { SectorAccess } from "./sector-access";

const BUSINESS_TZ = "America/Argentina/Salta";

export interface BoardQuery {
  sector: SectorCode;
  machineId?: string;
  materialId?: string;
  q?: string;
  /** Día de llegada (AAAA-MM-DD, hora de Salta). */
  date?: string;
  groupByMaterial?: boolean;
}

export interface TransitionBody {
  to: JobStatus;
  reasonId?: string;
  note?: string;
  quotedAmount?: string;
  estimatedReadyAt?: Date;
  force?: boolean;
}

/** Medianoche de hoy en Salta, en UTC (Salta es UTC-3 todo el año). */
function startOfBusinessDay(date = new Date()): Date {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date); // AAAA-MM-DD
  return new Date(`${local}T00:00:00-03:00`);
}

const cardInclude = {
  customer: { select: { id: true, customerNumber: true, firstName: true, lastName: true, status: true } },
  machine: { select: { id: true, name: true } },
  material: { select: { id: true, name: true } },
  _count: { select: { files: true } },
} satisfies Prisma.JobOrderInclude;

type CardRow = Prisma.JobOrderGetPayload<{ include: typeof cardInclude }>;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: SectorAccess,
  ) {}

  private async sectorWithStages(code: SectorCode) {
    const sector = await this.prisma.sector.findUnique({
      where: { code },
      include: {
        stages: { orderBy: { position: "asc" } },
        machines: { include: { machine: true } },
      },
    });
    if (!sector) throw new NotFoundException("Ese sector no existe");
    return sector;
  }

  private toCard(row: CardRow, sequence: JobStatus[], sameMaterial: Map<string, number>) {
    const allowed = allowedTransitions({ sequence, status: row.status, depositRequired: row.depositRequired });
    const name = [row.customer.firstName, row.customer.lastName].filter(Boolean).join(" ");
    return {
      id: row.id,
      number: row.number,
      label: formatJobNumber(row.number),
      status: row.status,
      statusLabel: JOB_STATUS_LABELS[row.status],
      customer: { id: row.customer.id, number: row.customer.customerNumber, name: name || null },
      description: row.description,
      measure: row.measure,
      quotedAmount: row.quotedAmount?.toString() ?? null,
      depositRequired: row.depositRequired,
      depositPaidAt: row.depositPaidAt,
      estimatedReadyAt: row.estimatedReadyAt,
      fileCount: row._count.files,
      linkCount: row.externalLinks.length,
      machine: row.machine,
      material: row.material,
      /** Otras órdenes pendientes del mismo material: candidatas a imprimir juntas (E1.4). */
      sameMaterialCount: row.materialProductId ? (sameMaterial.get(row.materialProductId) ?? 1) - 1 : 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      next: allowed.next,
      other: allowed.other,
    };
  }

  /** Tablero kanban de un sector (E1.4): una columna por paso de su secuencia, más "Archivo con error". */
  async board(user: AuthUser, query: BoardQuery) {
    const sector = await this.sectorWithStages(query.sector);
    await this.access.assert(user, sector.id);
    const sequence = sector.stages.map((s) => s.status);

    const where: Prisma.JobOrderWhereInput = {
      sectorId: sector.id,
      deletedAt: null,
      OR: [
        { status: { notIn: ["PENDING_SIGNUP", "CANCELLED", "DELIVERED"] } },
        // Los entregados solo del día, para que el tablero no crezca sin fin.
        { status: "DELIVERED", deliveredAt: { gte: startOfBusinessDay() } },
      ],
      ...(query.machineId ? { machineId: query.machineId } : {}),
      ...(query.materialId ? { materialProductId: query.materialId } : {}),
    };
    if (query.date) {
      const from = new Date(`${query.date}T00:00:00-03:00`);
      where.createdAt = { gte: from, lt: new Date(from.getTime() + 864e5) };
    }
    if (query.q) {
      const n = parseJobNumber(query.q) ?? (/^\d+$/.test(query.q.trim()) ? Number(query.q.trim()) : null);
      const terms = normalizeSearch(query.q).split(" ").filter(Boolean);
      where.AND = [
        {
          OR: [
            ...(n ? [{ number: n }, { customer: { customerNumber: n } }] : []),
            { customer: { AND: terms.map((t) => ({ searchText: { contains: t } })) } },
            { customer: { emails: { some: { email: { contains: query.q.trim().toLowerCase() } } } } },
          ],
        },
      ];
    }

    const rows = await this.prisma.jobOrder.findMany({
      where,
      include: cardInclude,
      // Por defecto, por orden de llegada (E1.4).
      orderBy: query.groupByMaterial
        ? [{ materialProductId: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
        : { createdAt: "asc" },
      take: 1000,
    });

    const pendingBeforePrint = new Set<JobStatus>(["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED"]);
    const sameMaterial = new Map<string, number>();
    for (const r of rows) {
      if (r.materialProductId && pendingBeforePrint.has(r.status)) {
        sameMaterial.set(r.materialProductId, (sameMaterial.get(r.materialProductId) ?? 0) + 1);
      }
    }

    const columns: JobStatus[] = [...sequence];
    columns.splice(1, 0, "FILE_ERROR");
    const cards = rows.map((r) => this.toCard(r, sequence, sameMaterial));

    return {
      sector: { id: sector.id, code: sector.code, name: sector.name },
      machines: sector.machines.map((m) => ({ id: m.machine.id, name: m.machine.name })).sort((a, b) => a.name.localeCompare(b.name)),
      columns: columns.map((status) => ({
        status,
        label: JOB_STATUS_LABELS[status],
        cards: cards.filter((c) => c.status === status),
      })),
      version: await this.version(sector.id),
    };
  }

  /** Huella del estado del tablero de un sector: cambia cuando entra o se mueve una orden. */
  async version(sectorId: string): Promise<string> {
    const agg = await this.prisma.jobOrder.aggregate({
      where: { sectorId },
      _max: { updatedAt: true },
      _count: true,
    });
    return `${agg._count}-${agg._max.updatedAt?.getTime() ?? 0}`;
  }

  async sectorIdForStream(user: AuthUser, code: SectorCode) {
    const sector = await this.prisma.sector.findUnique({ where: { code }, select: { id: true } });
    if (!sector) throw new NotFoundException("Ese sector no existe");
    await this.access.assert(user, sector.id);
    return sector.id;
  }

  async detail(user: AuthUser, id: string) {
    const job = await this.prisma.jobOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...cardInclude,
        sector: { include: { stages: { orderBy: { position: "asc" } } } },
        files: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        events: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { name: true } }, reason: { select: { label: true } } },
        },
      },
    });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    const sequence = job.sector.stages.map((s) => s.status);
    return {
      ...this.toCard(job, sequence, new Map()),
      sector: { id: job.sector.id, code: job.sector.code, name: job.sector.name },
      requestedSpecs: job.requestedSpecs,
      externalLinks: job.externalLinks,
      files: job.files.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) })),
      events: job.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        toLabel: JOB_STATUS_LABELS[e.toStatus],
        user: e.user?.name ?? null,
        reason: e.reason?.label ?? null,
        note: e.note,
        createdAt: e.createdAt,
      })),
    };
  }

  /** Cambio de estado con las reglas de la secuencia del sector (pasos obligatorios, R-JOB-2, R-JOB-3). */
  async transition(user: AuthUser, id: string, body: TransitionBody) {
    const job = await this.prisma.jobOrder.findFirst({
      where: { id, deletedAt: null },
      include: { sector: { include: { stages: { orderBy: { position: "asc" } } } } },
    });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);

    if (body.force && !user.roles.includes("OWNER")) {
      throw new ForbiddenException("Solo el dueño puede imprimir sin la seña registrada");
    }
    const sequence = job.sector.stages.map((s) => s.status);
    const check = checkTransition({ sequence, status: job.status, depositRequired: job.depositRequired }, body.to, body.force);
    if (!check.ok) throw new UnprocessableEntityException(check.reason);

    const data: Prisma.JobOrderUpdateManyMutationInput = { status: body.to };
    let priceChange: { before: string | null; after: string } | null = null;

    if (body.to === "FILE_ERROR") {
      const reason = await this.prisma.fileErrorReason.findFirst({ where: { id: body.reasonId, active: true } });
      if (!reason) throw new BadRequestException("Ese motivo de error no existe");
    }
    if (body.to === "QUOTED") {
      // R-JOB-2: la cotización se carga al pasar a Cotizado, antes de imprimir.
      if (!body.quotedAmount && !job.quotedAmount) {
        throw new UnprocessableEntityException("Para cotizar hay que cargar el precio");
      }
      if (body.quotedAmount) {
        const before = job.quotedAmount?.toString() ?? null;
        if (before !== new Prisma.Decimal(body.quotedAmount).toString()) {
          priceChange = { before, after: new Prisma.Decimal(body.quotedAmount).toString() };
        }
        data.quotedAmount = new Prisma.Decimal(body.quotedAmount);
      }
      data.quotedAt = new Date();
      if (body.estimatedReadyAt) data.estimatedReadyAt = body.estimatedReadyAt;
    }
    if (body.to === "DEPOSIT_RECEIVED") {
      data.depositPaidAt = new Date();
      data.paymentStatus = "DEPOSIT";
    }
    if (body.to === "DELIVERED") data.deliveredAt = new Date(); // desde acá corre la retención (D-015)

    await this.prisma.$transaction(async (tx) => {
      // Si otro operador la movió en el medio, no se pisa: se avisa para recargar.
      const { count } = await tx.jobOrder.updateMany({ where: { id, status: job.status }, data });
      if (count === 0) throw new ConflictException("La orden cambió mientras tanto. Actualizá el tablero.");
      await tx.jobEvent.create({
        data: {
          jobId: id,
          fromStatus: job.status,
          toStatus: body.to,
          userId: user.id,
          reasonId: body.to === "FILE_ERROR" ? body.reasonId : null,
          note: check.skipsDeposit ? `Sin seña (forzado por el dueño)${body.note ? `: ${body.note}` : ""}` : (body.note ?? null),
        },
      });
      if (priceChange) {
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "price", userId: user.id, before: { quotedAmount: priceChange.before }, after: { quotedAmount: priceChange.after } }, tx);
      }
      if (check.skipsDeposit) {
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "force_without_deposit", userId: user.id, before: { status: job.status }, after: { status: body.to, note: body.note ?? null } }, tx);
      }
    });

    return this.detail(user, id);
  }

  /** Asignación de máquina (E1.4). La máquina tiene que atender el sector de la orden. */
  async assignMachine(user: AuthUser, id: string, machineId: string | null) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    if (machineId) {
      const ok = await this.prisma.machineSector.findUnique({
        where: { machineId_sectorId: { machineId, sectorId: job.sectorId } },
        include: { machine: true },
      });
      if (!ok || !ok.machine.active) throw new BadRequestException("Esa máquina no trabaja en este sector");
    }
    await this.prisma.jobOrder.update({ where: { id }, data: { machineId } });
    return this.detail(user, id);
  }
}
