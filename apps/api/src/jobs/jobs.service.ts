import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  StreamableFile,
} from "@nestjs/common";
import { Prisma, type JobStatus } from "@prisma/client";
import {
  JOB_STATUS_LABELS,
  allowedTransitions,
  checkTransition,
  formatJobNumber,
  normalizeSearch,
  parseJobNumber,
  type SectorCode,
} from "@viavinilo/contracts";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../files/storage.service";
import { SectorAccess } from "./sector-access";

const BUSINESS_TZ = "America/Argentina/Salta";

/** Con qué se agrupan los pedidos del mismo material (D-095): la opción elegida o, si no, el producto. */
const materialKey = (r: { variantId: string | null; materialProductId: string | null }) =>
  r.variantId ? `v:${r.variantId}` : r.materialProductId ? `p:${r.materialProductId}` : null;

export interface BoardQuery {
  sector: SectorCode;
  /** Sub-servicio del tablero (D-082). */
  service?: SectorCode;
  /** Material u opción de impresión (D-095). */
  variant?: string;
  machineId?: string;
  materialId?: string;
  q?: string;
  /** Día de llegada (AAAA-MM-DD, hora de Salta). */
  date?: string;
  groupByMaterial?: boolean;
}

/** Columna del tablero para los cotizados que esperan la seña (D-081). */
export const AWAITING_DEPOSIT_COLUMN = "AWAITING_DEPOSIT";

export interface TransitionBody {
  to: JobStatus;
  reasonId?: string;
  note?: string;
  quotedAmount?: string;
  /** D-079: monto de la seña pedida al cotizar; null si el pedido no lleva seña. */
  depositAmount?: string | null;
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
  /** Material u opción de impresión con su código (D-095). */
  variant: { select: { id: true, code: true, name: true } },
  /** D-082: para decir de qué sub-servicio es el pedido en el tablero del padre. */
  sector: { select: { id: true, code: true, name: true, parentId: true } },
  _count: { select: { files: true } },
} satisfies Prisma.JobOrderInclude;

type CardRow = Prisma.JobOrderGetPayload<{ include: typeof cardInclude }>;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: SectorAccess,
    private readonly storage: StorageService,
  ) {}

  /**
   * Descarga del archivo del pedido (D-062). Desde D-086 se puede bajar en cualquier paso: el operador
   * lo tiene que abrir para cotizar. Sigue valiendo el permiso por sector (D-017).
   */
  async downloadFile(user: AuthUser, jobId: string, fileId: string) {
    const job = await this.prisma.jobOrder.findFirst({
      where: { id: jobId, deletedAt: null },
      include: { files: { where: { id: fileId, deletedAt: null } } },
    });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    const file = job.files[0];
    if (!file || file.purgedAt) throw new NotFoundException("Ese archivo ya no está disponible");
    const { stream, size } = await this.storage.open(file.storageKey);
    return new StreamableFile(stream, {
      type: file.mime || "application/octet-stream",
      length: size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    });
  }

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
      depositAmount: row.depositAmount?.toString() ?? null,
      depositPaidAt: row.depositPaidAt,
      estimatedReadyAt: row.estimatedReadyAt,
      /** Sucursal donde retira (D-083): "chile", "san-juan" o null si todavía no se sabe. */
      pickupBranch: row.pickupBranch,
      fileCount: row._count.files,
      /** Resultado del control automático del archivo (D-065). */
      fileCheck: row.fileCheck as { verdict: string; detail: string; hint?: string; linkNote?: string } | null,
      linkCount: row.externalLinks.length,
      machine: row.machine,
      // D-095: el material del pedido es la opción elegida; el producto queda para la E3.
      material: row.variant ? { id: row.variant.id, name: row.variant.name } : row.material,
      variant: row.variant,
      /** Sub-servicio del pedido (D-082): Látex, Ecosolvente… null si entró al tablero general. */
      service: row.sector.parentId ? { code: row.sector.code, name: row.sector.name } : null,
      /** Otras órdenes pendientes del mismo material: candidatas a imprimir juntas (E1.4). */
      sameMaterialCount: materialKey(row) ? (sameMaterial.get(materialKey(row)!) ?? 1) - 1 : 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      next: allowed.next,
      other: allowed.other,
    };
  }

  /** Tablero kanban de un sector (E1.4): una columna por paso de su secuencia, más "Archivo con error". */
  /**
   * Listado de pedidos (Ventas → Pedidos): datos reales, sin ejemplos. Producción ve solo sus
   * sectores (D-017). "En curso" es todo lo que todavía no está listo, entregado ni cancelado.
   */
  async list(
    user: AuthUser,
    q: { tab: "ACTIVE" | "READY" | "DELIVERED" | "ALL"; sector?: string; source?: "EMAIL" | "COUNTER" | "API"; search?: string; page: number; pageSize: number },
  ) {
    const allowed = await this.access.allowedSectorIds(user);
    const where: Prisma.JobOrderWhereInput = { deletedAt: null };
    if (allowed !== "all") where.sectorId = { in: allowed };
    // D-082: filtrar por un tablero trae también sus sub-servicios.
    if (q.sector) where.sector = { OR: [{ code: q.sector as SectorCode }, { parent: { code: q.sector as SectorCode } }] };
    if (q.source) where.source = q.source;
    if (q.tab === "ACTIVE") where.status = { notIn: ["READY", "DELIVERED", "CANCELLED"] };
    if (q.tab === "READY") where.status = "READY";
    if (q.tab === "DELIVERED") where.status = "DELIVERED";
    if (q.search) {
      // Solo los dígitos: con "/D/" (sin la barra) un nombre quedaba como "número" y la búsqueda fallaba.
      const digits = q.search.replace(/\D/g, "");
      const terms = normalizeSearch(q.search).split(" ").filter(Boolean);
      where.OR = [
        { customer: { AND: terms.map((t) => ({ searchText: { contains: t } })) } },
        { description: { contains: q.search, mode: "insensitive" } },
        ...(digits && digits.length <= 9 ? [{ number: Number(digits) }, { customer: { customerNumber: Number(digits) } }] : []),
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.jobOrder.count({ where }),
      this.prisma.jobOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          number: true,
          status: true,
          source: true,
          description: true,
          measure: true,
          quotedAmount: true,
          depositRequired: true,
          depositPaidAt: true,
          estimatedReadyAt: true,
          createdAt: true,
          sector: { select: { code: true, name: true } },
          customer: { select: { id: true, customerNumber: true, firstName: true, lastName: true, businessName: true, status: true } },
        },
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: rows.map((r) => ({
        ...r,
        label: formatJobNumber(r.number),
        statusLabel: JOB_STATUS_LABELS[r.status],
        quotedAmount: r.quotedAmount?.toString() ?? null,
      })),
    };
  }

  /**
   * Resumen de Inicio (D-089). Dos cosas distintas:
   * - **Foto del taller ahora** (no depende del período): cuántos pedidos hay en cada paso.
   * - **Período elegido**: cuántos entraron y cuántos se entregaron, y los totales en pesos.
   * Todo se calcula en la base (antes Inicio bajaba los tableros enteros y contaba en el navegador).
   * Los pesos solo viajan si el usuario es dueño o tiene el permiso `canSeeBilling`.
   */
  async summary(user: AuthUser, q: { from?: string; to?: string; sector?: string }) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
    const fromDay = q.from ?? q.to ?? today;
    const toDay = q.to ?? q.from ?? today;
    if (fromDay > toDay) throw new BadRequestException("El período está al revés: la fecha desde es posterior a la fecha hasta");
    const from = new Date(`${fromDay}T00:00:00-03:00`);
    const to = new Date(new Date(`${toDay}T00:00:00-03:00`).getTime() + 864e5);

    const allowed = await this.access.allowedSectorIds(user);
    const base: Prisma.JobOrderWhereInput = { deletedAt: null };
    if (allowed !== "all") base.sectorId = { in: allowed };
    if (q.sector) base.sector = { OR: [{ code: q.sector }, { parent: { code: q.sector } }] };

    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { canSeeBilling: true } });
    const canSeeAmounts = user.roles.includes("OWNER") || me?.canSeeBilling === true;
    const period = { gte: from, lt: to };
    const sum = (where: Prisma.JobOrderWhereInput, field: "quotedAmount" | "depositAmount") =>
      this.prisma.jobOrder.aggregate({ where: { ...base, ...where }, _sum: { [field]: true }, _count: true });

    const [byStatus, waitingDeposit, entered, delivered, sectors] = await Promise.all([
      this.prisma.jobOrder.groupBy({ by: ["status", "sectorId"], where: { ...base, status: { notIn: ["DELIVERED", "CANCELLED"] } }, _count: true }),
      this.prisma.jobOrder.groupBy({ by: ["sectorId"], where: { ...base, status: "QUOTED", depositRequired: true, depositPaidAt: null }, _count: true }),
      this.prisma.jobOrder.count({ where: { ...base, createdAt: period } }),
      this.prisma.jobOrder.count({ where: { ...base, status: "DELIVERED", deliveredAt: period } }),
      this.prisma.sector.findMany({ where: { active: true }, select: { id: true, code: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
    ]);

    // Cada pedido cuenta en el tablero raíz (los sub-servicios suman en Gran Formato).
    const rootOf = new Map(sectors.map((s) => [s.id, s.parentId ?? s.id]));
    const empty = () => ({ toQuote: 0, fileError: 0, waitingDeposit: 0, inProduction: 0, ready: 0 });
    const boards = new Map<string, ReturnType<typeof empty>>();
    const bucket = (sectorId: string) => {
      const root = rootOf.get(sectorId) ?? sectorId;
      if (!boards.has(root)) boards.set(root, empty());
      return boards.get(root)!;
    };
    for (const row of byStatus) {
      const b = bucket(row.sectorId);
      if (row.status === "RECEIVED" || row.status === "PENDING_SIGNUP") b.toQuote += row._count;
      else if (row.status === "FILE_ERROR") b.fileError += row._count;
      else if (row.status === "READY") b.ready += row._count;
      // Cotizado, con seña, impreso o en calandra: ya está en marcha. Los que esperan seña se restan abajo.
      else b.inProduction += row._count;
    }
    for (const row of waitingDeposit) {
      const b = bucket(row.sectorId);
      b.waitingDeposit += row._count;
      b.inProduction -= row._count;
    }
    const visible = sectors.filter((s) => !s.parentId && (allowed === "all" || allowed.includes(s.id) || boards.has(s.id)) && (!q.sector || s.code === q.sector));
    const perBoard = visible.map((s) => ({ code: s.code, name: s.name, ...(boards.get(s.id) ?? empty()) }));
    const now = perBoard.reduce((acc, b) => ({ toQuote: acc.toQuote + b.toQuote, fileError: acc.fileError + b.fileError, waitingDeposit: acc.waitingDeposit + b.waitingDeposit, inProduction: acc.inProduction + b.inProduction, ready: acc.ready + b.ready }), empty());

    let amounts: { quoted: string; quotedCount: number; delivered: string; deposits: string } | null = null;
    if (canSeeAmounts) {
      const [quoted, deliveredSum, deposits] = await Promise.all([
        sum({ quotedAt: period, status: { not: "CANCELLED" } }, "quotedAmount"),
        sum({ status: "DELIVERED", deliveredAt: period }, "quotedAmount"),
        sum({ depositPaidAt: period, status: { not: "CANCELLED" } }, "depositAmount"),
      ]);
      const text = (v: unknown) => (v as Prisma.Decimal | null)?.toString() ?? "0";
      amounts = {
        /** Cotizado en el período: suma de los precios cargados esos días. */
        quoted: text(quoted._sum.quotedAmount),
        quotedCount: quoted._count,
        /** Entregado en el período: lo más parecido a "facturado" hasta que exista la facturación (Etapa 3). */
        delivered: text(deliveredSum._sum.quotedAmount),
        /** Señas registradas en el período. */
        deposits: text(deposits._sum.depositAmount),
      };
    }

    // Conversaciones sin leer: solo para quien atiende (dueño y atención).
    let conversations: { unread: number; latest: { id: string; name: string; preview: string | null; at: Date | null; unread: number }[] } | null = null;
    if (user.roles.includes("OWNER") || user.roles.includes("ATTENTION")) {
      const [unread, latest] = await Promise.all([
        this.prisma.conversation.count({ where: { staffUnread: { gt: 0 } } }),
        this.prisma.conversation.findMany({
          where: { staffUnread: { gt: 0 } },
          orderBy: { lastMessageAt: "desc" },
          take: 5,
          select: { id: true, lastMessagePreview: true, lastMessageAt: true, staffUnread: true, customer: { select: { customerNumber: true, firstName: true, lastName: true, businessName: true } } },
        }),
      ]);
      conversations = {
        unread,
        latest: latest.map((c) => ({
          id: c.id,
          name: [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(" ") || c.customer?.businessName || (c.customer ? `Cliente N.º ${c.customer.customerNumber}` : "Sin cliente"),
          preview: c.lastMessagePreview,
          at: c.lastMessageAt,
          unread: c.staffUnread,
        })),
      };
    }

    return { from: fromDay, to: toDay, period: { entered, delivered }, now, perBoard, canSeeAmounts, amounts, conversations };
  }

  /**
   * Trabajos por cliente (D-084): los pedidos en curso (ni entregados ni cancelados) agrupados por
   * cliente, de todos los sectores que ve el usuario. Sirve para que caja junte lo que un cliente
   * tiene repartido en varios tableros. Primero los clientes con algo listo para retirar.
   */
  async byCustomer(user: AuthUser, q: { search?: string; pickup?: string; several?: boolean; page?: number; pageSize?: number }) {
    const allowed = await this.access.allowedSectorIds(user);
    const where: Prisma.JobOrderWhereInput = { deletedAt: null, status: { notIn: ["DELIVERED", "CANCELLED"] } };
    if (allowed !== "all") where.sectorId = { in: allowed };
    if (q.search) {
      const digits = q.search.replace(/\D/g, "");
      const terms = normalizeSearch(q.search).split(" ").filter(Boolean);
      where.OR = [
        { customer: { AND: terms.map((t) => ({ searchText: { contains: t } })) } },
        ...(digits && digits.length <= 9 ? [{ number: Number(digits) }, { customer: { customerNumber: Number(digits) } }] : []),
      ];
    }
    const rows = await this.prisma.jobOrder.findMany({
      where,
      orderBy: { createdAt: "asc" },
      // Se agrupa en memoria: son los pedidos en curso, no el historial. El tope es una red de seguridad.
      take: 10_000,
      select: {
        id: true,
        number: true,
        status: true,
        description: true,
        measure: true,
        quotedAmount: true,
        depositRequired: true,
        depositAmount: true,
        depositPaidAt: true,
        estimatedReadyAt: true,
        pickupBranch: true,
        createdAt: true,
        sector: { select: { code: true, name: true, parent: { select: { code: true, name: true } } } },
        customer: { select: { id: true, customerNumber: true, firstName: true, lastName: true, businessName: true } },
      },
    });

    type Row = (typeof rows)[number];
    const groups = new Map<string, { customer: NonNullable<Row["customer"]>; jobs: Row[] }>();
    for (const r of rows) {
      if (!r.customer) continue;
      const g = groups.get(r.customer.id) ?? { customer: r.customer, jobs: [] };
      g.jobs.push(r);
      groups.set(r.customer.id, g);
    }
    const customers = [...groups.values()]
      .filter((g) => !q.pickup || g.jobs.some((j) => j.pickupBranch === q.pickup))
      .map((g) => {
        const boards = new Set(g.jobs.map((j) => j.sector.parent?.name ?? j.sector.name));
        const amounts = g.jobs.filter((j) => j.quotedAmount);
        return {
          customer: {
            id: g.customer.id,
            number: g.customer.customerNumber,
            name: [g.customer.firstName, g.customer.lastName].filter(Boolean).join(" ") || g.customer.businessName || null,
          },
          total: g.jobs.length,
          ready: g.jobs.filter((j) => j.status === "READY").length,
          /** En cuántos tableros tiene trabajos: más de uno es lo que hay que juntar. */
          boards: [...boards].sort(),
          /** Suma de lo cotizado; null si ninguno está cotizado. */
          quotedTotal: amounts.length ? amounts.reduce((sum, j) => sum.plus(j.quotedAmount!), new Prisma.Decimal(0)).toString() : null,
          jobs: g.jobs.map((j) => ({
            id: j.id,
            label: formatJobNumber(j.number),
            status: j.status,
            statusLabel: j.status === "QUOTED" && j.depositRequired && !j.depositPaidAt ? "Esperando seña" : JOB_STATUS_LABELS[j.status],
            /** Tablero donde se mueve el pedido y, si tiene, el sub-servicio (D-082). */
            board: { code: j.sector.parent?.code ?? j.sector.code, name: j.sector.parent?.name ?? j.sector.name },
            service: j.sector.parent ? j.sector.name : null,
            description: j.description,
            measure: j.measure,
            quotedAmount: j.quotedAmount?.toString() ?? null,
            depositAmount: j.depositRequired ? (j.depositAmount?.toString() ?? null) : null,
            depositPending: j.depositRequired && !j.depositPaidAt,
            estimatedReadyAt: j.estimatedReadyAt,
            pickupBranch: j.pickupBranch,
            createdAt: j.createdAt,
          })),
        };
      })
      .filter((c) => !q.several || c.boards.length > 1)
      .sort((a, b) => b.ready - a.ready || b.total - a.total || (a.customer.name ?? "").localeCompare(b.customer.name ?? ""));
    // D-085: por páginas, para que no quede ningún cliente afuera (antes se cortaba en 200 sin avisar).
    const pageSize = q.pageSize ?? 30;
    const page = q.page ?? 1;
    return {
      customers: customers.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCustomers: customers.length,
      totalJobs: customers.reduce((n, c) => n + c.total, 0),
    };
  }

  async board(user: AuthUser, query: BoardQuery) {
    const sector = await this.sectorWithStages(query.sector);
    const family = await this.family(user, sector.id);
    const sequence = sector.stages.map((s) => s.status);
    const only = query.service ? family.find((f) => f.code === query.service) : undefined;
    if (query.service && !only) throw new NotFoundException("Ese servicio no es de este tablero");

    const where: Prisma.JobOrderWhereInput = {
      sectorId: only ? only.id : { in: family.map((f) => f.id) },
      deletedAt: null,
      OR: [
        { status: { notIn: ["PENDING_SIGNUP", "CANCELLED", "DELIVERED"] } },
        // Los entregados solo del día, para que el tablero no crezca sin fin.
        { status: "DELIVERED", deliveredAt: { gte: startOfBusinessDay() } },
      ],
      ...(query.machineId ? { machineId: query.machineId } : {}),
      ...(query.materialId ? { materialProductId: query.materialId } : {}),
      ...(query.variant ? { variantId: query.variant } : {}),
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
            // D-095: también por el código o el nombre del material ("DTF-GLI", "glitter").
            { variant: { OR: [{ code: query.q.trim().toUpperCase() }, { name: { contains: query.q.trim(), mode: "insensitive" } }] } },
          ],
        },
      ];
    }

    const rows = await this.prisma.jobOrder.findMany({
      where,
      include: cardInclude,
      // Por defecto, por orden de llegada (E1.4).
      orderBy: query.groupByMaterial
        ? [{ variantId: { sort: "asc", nulls: "last" } }, { materialProductId: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
        : { createdAt: "asc" },
      take: 1000,
    });

    const pendingBeforePrint = new Set<JobStatus>(["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED"]);
    const sameMaterial = new Map<string, number>();
    for (const r of rows) {
      const key = materialKey(r);
      if (key && pendingBeforePrint.has(r.status)) {
        sameMaterial.set(key, (sameMaterial.get(key) ?? 0) + 1);
      }
    }

    const columns: JobStatus[] = [...sequence];
    columns.splice(1, 0, "FILE_ERROR");
    const cards = rows.map((r) => this.toCard(r, sequence, sameMaterial));

    return {
      sector: { id: sector.id, code: sector.code, name: sector.name },
      /** Materiales de los tableros que se ven, para filtrar (D-095). */
      variants: await this.prisma.sectorVariant.findMany({
        where: { active: true, sectorId: { in: family.map((f) => f.id) } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      /** Sub-servicios del tablero que ve este usuario (D-082). Vacío si el tablero no tiene. */
      services: family.filter((f) => f.id !== sector.id).map((f) => ({ code: f.code, name: f.name })),
      machines: sector.machines.map((m) => ({ id: m.machine.id, name: m.machine.name })).sort((a, b) => a.name.localeCompare(b.name)),
      columns: columns.flatMap((status) => {
        const own = cards.filter((c) => c.status === status);
        const column = (key: string, label: string, list: typeof own) => ({ key, status, label, cards: list });
        // D-081: los cotizados que esperan la seña van en su propia columna. No es un estado nuevo:
        // el pedido sigue "Cotizado" hasta que se registra la seña.
        if (status === "QUOTED" && sequence.includes("DEPOSIT_RECEIVED")) {
          const waiting = (c: (typeof own)[number]) => c.depositRequired && !c.depositPaidAt;
          return [
            column("QUOTED", JOB_STATUS_LABELS.QUOTED, own.filter((c) => !waiting(c))),
            column(AWAITING_DEPOSIT_COLUMN, "Esperando seña", own.filter(waiting)),
          ];
        }
        return [column(status, JOB_STATUS_LABELS[status], own)];
      }),
      version: await this.version(sector.id),
    };
  }

  /** Huella del estado del tablero de un sector: cambia cuando entra o se mueve una orden. */
  async version(sectorId: string): Promise<string> {
    const agg = await this.prisma.jobOrder.aggregate({
      // D-082: también cuentan los pedidos de los sub-servicios del tablero.
      where: { OR: [{ sectorId }, { sector: { parentId: sectorId } }] },
      _max: { updatedAt: true },
      _count: true,
    });
    return `${agg._count}-${agg._max.updatedAt?.getTime() ?? 0}`;
  }

  async sectorIdForStream(user: AuthUser, code: SectorCode) {
    const sector = await this.prisma.sector.findUnique({ where: { code }, select: { id: true } });
    if (!sector) throw new NotFoundException("Ese sector no existe");
    await this.family(user, sector.id);
    return sector.id;
  }

  /**
   * El tablero y sus sub-servicios activos que puede ver el usuario (D-082). Producción con un solo
   * sub-servicio (por ejemplo Látex) entra al tablero de Gran Formato y ve solo lo suyo.
   */
  private async family(user: AuthUser, sectorId: string) {
    const rows = await this.prisma.sector.findMany({
      where: { OR: [{ id: sectorId }, { parentId: sectorId, active: true }] },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
    const allowed = await this.access.allowedSectorIds(user);
    const visible = allowed === "all" ? rows : rows.filter((r) => allowed.includes(r.id));
    if (!visible.length) throw new ForbiddenException("No tenés acceso a este sector");
    return visible;
  }

  /**
   * Cambia el sub-servicio de un pedido (D-082): por ejemplo, un mail que entró a la casilla general de
   * Gran Formato y era de Látex. Solo dentro del mismo tablero; queda auditado.
   */
  async moveService(user: AuthUser, id: string, code: string) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null }, include: { sector: true } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    const target = await this.prisma.sector.findFirst({ where: { code, active: true }, include: { stages: true, machines: true } });
    const root = (s: { id: string; parentId: string | null }) => s.parentId ?? s.id;
    if (!target || root(target) !== root(job.sector)) throw new BadRequestException("Ese servicio no es de este tablero");
    await this.access.assert(user, target.id);
    if (target.id === job.sectorId) return this.detail(user, id);
    if (job.status !== "PENDING_SIGNUP" && job.status !== "FILE_ERROR" && job.status !== "CANCELLED" && !target.stages.some((s) => s.status === job.status)) {
      throw new UnprocessableEntityException("Ese servicio no tiene el paso en el que está el pedido");
    }
    // La máquina se conserva solo si también trabaja en el servicio nuevo.
    const keepsMachine = !job.machineId || target.machines.some((m) => m.machineId === job.machineId);
    await this.prisma.$transaction(async (tx) => {
      // fileCheck en null: el mínimo de resolución puede ser otro, se vuelve a controlar.
      await tx.jobOrder.update({
        where: { id },
        data: { sectorId: target.id, ...(keepsMachine ? {} : { machineId: null }), variantId: null, ...(job.status === "RECEIVED" ? { fileCheck: Prisma.DbNull } : {}) },
      });
      await this.audit.log({ entity: "JobOrder", entityId: id, action: "service", userId: user.id, before: { sector: job.sector.code }, after: { sector: target.code } }, tx);
    });
    return this.detail(user, id);
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
    const rootId = job.sector.parentId ?? job.sector.id;
    const family = await this.family(user, rootId).catch(() => []);
    return {
      ...this.toCard(job, sequence, new Map()),
      sector: { id: job.sector.id, code: job.sector.code, name: job.sector.name },
      /** Materiales del tablero del pedido, para elegir o corregir (D-095). */
      variants: await this.prisma.sectorVariant.findMany({
        where: { sectorId: job.sectorId, OR: [{ active: true }, { id: job.variantId ?? "" }] },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      /** Tablero y sub-servicios entre los que se puede mover el pedido (D-082). */
      services: family.length > 1 ? family.map((f) => ({ code: f.code, name: f.id === rootId ? `${f.name} (sin sub-servicio)` : f.name })) : [],
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
    let depositChange: { before: string | null; after: string | null } | null = null;

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
      // D-079: la seña se pide al cotizar. Sin el campo, el pedido queda como estaba.
      if (body.depositAmount !== undefined) {
        const deposit = body.depositAmount && Number(body.depositAmount) > 0 ? new Prisma.Decimal(body.depositAmount) : null;
        const price = body.quotedAmount ? new Prisma.Decimal(body.quotedAmount) : job.quotedAmount;
        if (deposit && price && deposit.gt(price)) throw new UnprocessableEntityException("La seña no puede ser mayor que el precio");
        const before = job.depositRequired ? (job.depositAmount?.toString() ?? "sin monto") : null;
        const after = deposit?.toString() ?? null;
        if (before !== after) depositChange = { before, after };
        data.depositRequired = deposit !== null;
        data.depositAmount = deposit;
      }
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
      if (depositChange) {
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "deposit", userId: user.id, before: { depositAmount: depositChange.before }, after: { depositAmount: depositChange.after } }, tx);
      }
      if (check.skipsDeposit) {
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "force_without_deposit", userId: user.id, before: { status: job.status }, after: { status: body.to, note: body.note ?? null } }, tx);
      }
    });

    return this.detail(user, id);
  }

  /**
   * Eliminar un pedido (D-088): para pedidos de prueba, duplicados o cargados por error. Es un borrado
   * lógico: el pedido deja de verse en el tablero, en los listados y en la app del cliente, pero queda
   * en la base con su historial y el log de auditoría. No avisa al cliente. Si el pedido es real y el
   * cliente lo dio de baja, corresponde "Cancelar", que sí queda a la vista.
   */
  async remove(user: AuthUser, id: string, reason: string) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.jobOrder.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      if (count === 0) return;
      await this.audit.log(
        { entity: "JobOrder", entityId: id, action: "delete", userId: user.id, before: { number: job.number, status: job.status, quotedAmount: job.quotedAmount?.toString() ?? null }, after: { deleted: true, reason } },
        tx,
      );
    });
    return { ok: true, label: formatJobNumber(job.number) };
  }

  /** Material u opción de impresión del pedido (D-095). Tiene que ser del tablero del pedido; queda auditado. */
  async setVariant(user: AuthUser, id: string, variantId: string | null) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null }, include: { variant: { select: { code: true } } } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    const variant = variantId ? await this.prisma.sectorVariant.findFirst({ where: { id: variantId, sectorId: job.sectorId } }) : null;
    if (variantId && !variant) throw new BadRequestException("Esa opción de impresión no es de este tablero");
    if (job.variantId !== (variant?.id ?? null)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.jobOrder.update({ where: { id }, data: { variantId: variant?.id ?? null } });
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "variant", userId: user.id, before: { variant: job.variant?.code ?? null }, after: { variant: variant?.code ?? null } }, tx);
      });
    }
    return this.detail(user, id);
  }

  /**
   * Medida pedida (D-086): la corrige el taller cuando el cliente la escribió mal o no la escribió.
   * El control del archivo se vuelve a hacer con la medida nueva. Queda auditado.
   */
  async setMeasure(user: AuthUser, id: string, measure: string | null) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    if ((job.measure ?? null) !== measure) {
      const specs = { ...((job.requestedSpecs as Record<string, unknown> | null) ?? {}), measureEdited: true };
      // D-091: los pedidos de la app arrancan la descripción con la medida; se actualiza para que no quede la vieja.
      const description = job.measure && measure && job.description?.startsWith(job.measure) ? `${measure}${job.description.slice(job.measure.length)}` : undefined;
      // D-091: si el error lo puso el control automático, con la medida nueva el pedido vuelve a
      // "Archivo recibido" y se controla otra vez. Un error puesto por una persona no se toca.
      const lastError = job.status === "FILE_ERROR" ? await this.prisma.jobEvent.findFirst({ where: { jobId: id, toStatus: "FILE_ERROR" }, orderBy: { createdAt: "desc" } }) : null;
      const recheck = lastError !== null && lastError.userId === null;
      await this.prisma.$transaction(async (tx) => {
        await tx.jobOrder.update({
          where: { id },
          data: {
            measure,
            requestedSpecs: specs as Prisma.InputJsonValue,
            ...(description ? { description } : {}),
            ...(job.status === "RECEIVED" || recheck ? { fileCheck: Prisma.DbNull } : {}),
            ...(recheck ? { status: "RECEIVED" } : {}),
          },
        });
        if (recheck) {
          // notifiedCustomer en true: el cliente no mandó nada, no corresponde avisarle "recibimos tu archivo".
          await tx.jobEvent.create({
            data: { jobId: id, fromStatus: "FILE_ERROR", toStatus: "RECEIVED", userId: user.id, note: "El taller corrigió la medida: se vuelve a controlar el archivo", notifiedCustomer: true },
          });
        }
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "measure", userId: user.id, before: { measure: job.measure }, after: { measure } }, tx);
      });
    }
    return this.detail(user, id);
  }

  /** Sucursal donde retira el cliente (D-083). La puede corregir el taller; queda auditado. */
  async setPickup(user: AuthUser, id: string, branch: string | null) {
    const job = await this.prisma.jobOrder.findFirst({ where: { id, deletedAt: null } });
    if (!job) throw new NotFoundException("No encontramos esa orden");
    await this.access.assert(user, job.sectorId);
    if (job.pickupBranch !== branch) {
      await this.prisma.$transaction(async (tx) => {
        await tx.jobOrder.update({ where: { id }, data: { pickupBranch: branch } });
        await this.audit.log({ entity: "JobOrder", entityId: id, action: "pickup", userId: user.id, before: { pickupBranch: job.pickupBranch }, after: { pickupBranch: branch } }, tx);
      });
    }
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
