import { Controller, Get, Injectable } from "@nestjs/common";
import type { JobStatus, Prisma } from "@prisma/client";
import { alertSettingsSchema, DEFAULT_ALERT_SETTINGS, elapsedMs, formatJobNumber, type AlertSettings } from "@viavinilo/contracts";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/decorators";
import { ZodQuery } from "../common/zod";
import { PrismaService } from "../prisma/prisma.service";
import { SectorAccess } from "./sector-access";

const timesQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

/** Estados en los que un pedido ya no espera nada del taller. */
const CLOSED: JobStatus[] = ["DELIVERED", "CANCELLED"];
/** "Listo para retirar" espera al cliente, no al taller: no cuenta como demorado. */
const NOT_DELAYED: JobStatus[] = [...CLOSED, "READY"];
const DELAYED_LIMIT = 100;

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Salta" });
const HOUR = 3_600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Panel de tiempos (SPEC E1.6): trabajos por día, por sector y por máquina; tiempo promedio en cada
 * estado; y órdenes demoradas (más de X horas en el mismo estado, configurable). Todo sale de los
 * cambios de estado reales del tablero (JobEvent). Las horas son corridas o, si el dueño lo elige,
 * solo las del horario de atención (D-073).
 */
@Injectable()
export class TimesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SectorAccess,
  ) {}

  async settings(): Promise<AlertSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: "alerts" } });
    const parsed = alertSettingsSchema.safeParse(row?.value);
    return parsed.success ? parsed.data : DEFAULT_ALERT_SETTINGS;
  }

  async panel(user: AuthUser, days: number, now = new Date()) {
    const allowed = await this.access.allowedSectorIds(user);
    const scope: Prisma.JobOrderWhereInput = { deletedAt: null, ...(allowed === "all" ? {} : { sectorId: { in: allowed } }) };
    const since = new Date(now.getTime() - days * 24 * HOUR);
    const { delayedHours, businessHoursOnly } = await this.settings();

    const [created, events, open, sectors] = await Promise.all([
      // Trabajos que entraron en el período.
      this.prisma.jobOrder.findMany({
        where: { ...scope, createdAt: { gte: since } },
        select: { createdAt: true, sector: { select: { name: true } }, machine: { select: { name: true } } },
      }),
      // Cambios de estado de los pedidos que se movieron en el período, con toda su historia.
      this.prisma.jobEvent.findMany({
        where: { job: { ...scope, events: { some: { createdAt: { gte: since } } } } },
        orderBy: [{ jobId: "asc" }, { createdAt: "asc" }],
        select: { jobId: true, toStatus: true, createdAt: true, job: { select: { sector: { select: { name: true } } } } },
      }),
      // Pedidos abiertos, con su último cambio de estado.
      this.prisma.jobOrder.findMany({
        where: { ...scope, status: { notIn: NOT_DELAYED } },
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          sector: { select: { code: true, name: true } },
          machine: { select: { name: true } },
          customer: { select: { firstName: true, lastName: true, businessName: true } },
          events: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      }),
      this.prisma.sector.findMany({ where: { active: true, ...(allowed === "all" ? {} : { id: { in: allowed } }) }, orderBy: { name: "asc" }, select: { name: true } }),
    ]);

    // ── Trabajos por día y sector ──
    const dayList: string[] = [];
    for (let i = days - 1; i >= 0; i--) dayList.push(dayKey.format(new Date(now.getTime() - i * 24 * HOUR)));
    const perDay = new Map(dayList.map((d) => [d, new Map<string, number>()]));
    const perMachine = new Map<string, number>();
    for (const j of created) {
      const bucket = perDay.get(dayKey.format(j.createdAt));
      if (bucket) bucket.set(j.sector.name, (bucket.get(j.sector.name) ?? 0) + 1);
      const machine = j.machine?.name ?? "Sin máquina asignada";
      perMachine.set(machine, (perMachine.get(machine) ?? 0) + 1);
    }

    // ── Tiempo promedio en cada estado ──
    // Cada tramo va de un cambio de estado al siguiente; el último tramo de un pedido abierto no cuenta todavía.
    const stage = new Map<string, { sector: string; status: JobStatus; totalMs: number; count: number }>();
    for (let i = 0; i < events.length - 1; i++) {
      const a = events[i]!;
      const b = events[i + 1]!;
      if (a.jobId !== b.jobId || b.createdAt < since || CLOSED.includes(a.toStatus)) continue;
      const key = `${a.job.sector.name}|${a.toStatus}`;
      const row = stage.get(key) ?? { sector: a.job.sector.name, status: a.toStatus, totalMs: 0, count: 0 };
      row.totalMs += elapsedMs(a.createdAt, b.createdAt, businessHoursOnly);
      row.count++;
      stage.set(key, row);
    }

    // ── Demorados ──
    const limitMs = delayedHours * HOUR;
    const delayed = open
      .map((j) => {
        const since = j.events[0]?.createdAt ?? j.createdAt;
        return { j, since, waitedMs: elapsedMs(since, now, businessHoursOnly) };
      })
      .filter((x) => x.waitedMs > limitMs)
      .sort((a, b) => b.waitedMs - a.waitedMs || a.since.getTime() - b.since.getTime());

    return {
      days,
      delayedHours,
      businessHoursOnly,
      totals: { created: created.length, open: open.length, delayed: delayed.length },
      sectors: sectors.map((s) => s.name),
      perDay: dayList.map((date) => ({ date, total: [...perDay.get(date)!.values()].reduce((n, v) => n + v, 0), bySector: Object.fromEntries(perDay.get(date)!) })),
      perMachine: [...perMachine].map(([machine, count]) => ({ machine, count })).sort((a, b) => b.count - a.count),
      stageAverages: [...stage.values()]
        .map((r) => ({ sector: r.sector, status: r.status, avgHours: round1(r.totalMs / r.count / HOUR), count: r.count }))
        .sort((a, b) => a.sector.localeCompare(b.sector) || b.avgHours - a.avgHours),
      delayed: delayed.slice(0, DELAYED_LIMIT).map(({ j, since: at, waitedMs }) => ({
        id: j.id,
        number: formatJobNumber(j.number),
        sectorCode: j.sector.code,
        sector: j.sector.name,
        machine: j.machine?.name ?? null,
        status: j.status,
        customer: j.customer.businessName || [j.customer.firstName, j.customer.lastName].filter(Boolean).join(" ") || "Sin nombre",
        since: at,
        hours: round1(waitedMs / HOUR),
      })),
    };
  }
}

@Controller("jobs/times")
export class TimesController {
  constructor(private readonly times: TimesService) {}

  @Get()
  panel(@ZodQuery(timesQuerySchema) query: { days: number }, @CurrentUser() user: AuthUser) {
    return this.times.panel(user, query.days);
  }

  /** Desde cuántas horas en el mismo paso un pedido cuenta como demorado (lo usa también Inicio). */
  @Get("threshold")
  async threshold() {
    const { delayedHours, businessHoursOnly } = await this.times.settings();
    return { delayedHours, businessHoursOnly };
  }
}
