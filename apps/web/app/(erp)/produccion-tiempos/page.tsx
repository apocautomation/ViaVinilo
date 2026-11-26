"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ClipboardList, Factory, Timer } from "lucide-react";
import { JOB_STATUS_LABELS, type JobStatus } from "@viavinilo/contracts";
import { useApiQuery } from "../hooks";
import { Badge, Kpi, PageHead } from "../ui";

/**
 * Panel de tiempos (SPEC E1.6, D-070): trabajos por día, por sector y por máquina; tiempo promedio
 * en cada estado; y pedidos demorados. Sale de los cambios de estado reales del tablero.
 */
interface Times {
  days: number;
  delayedHours: number;
  businessHoursOnly: boolean;
  totals: { created: number; open: number; delayed: number };
  sectors: string[];
  perDay: { date: string; total: number; bySector: Record<string, number> }[];
  perMachine: { machine: string; count: number }[];
  stageAverages: { sector: string; status: JobStatus; avgHours: number; count: number }[];
  delayed: { id: string; number: string; sectorCode: string; sector: string; machine: string | null; status: JobStatus; customer: string; since: string; hours: number }[];
}

const PERIODS = [7, 14, 30, 90] as const;

/** 3,5 h → "3 h 30 min"; 30 h → "1 d 6 h". */
function duration(hours: number): string {
  const min = Math.round(hours * 60);
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
  const d = Math.floor(min / (24 * 60));
  const h = Math.floor((min % (24 * 60)) / 60);
  return `${d} d${h ? ` ${h} h` : ""}`;
}

/** "2026-11-21" → "21/11" */
const shortDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export default function TiemposPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14);
  const [sector, setSector] = useState("");
  const { data, error } = useApiQuery<Times>(`/jobs/times?days=${days}`, "No pudimos cargar los tiempos.");

  const perDay = (data?.perDay ?? []).map((d) => ({ date: d.date, count: sector ? (d.bySector[sector] ?? 0) : d.total }));
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));
  const bySector = (data?.sectors ?? []).map((name) => ({ name, count: (data?.perDay ?? []).reduce((n, d) => n + (d.bySector[name] ?? 0), 0) }));
  const maxSector = Math.max(1, ...bySector.map((s) => s.count));
  const maxMachine = Math.max(1, ...(data?.perMachine ?? []).map((m) => m.count));
  const averages = (data?.stageAverages ?? []).filter((r) => !sector || r.sector === sector);
  const delayed = (data?.delayed ?? []).filter((d) => !sector || d.sector === sector);
  const empty = data !== null && data.totals.created === 0 && data.totals.open === 0;

  return (
    <div className="page">
      <PageHead
        title="Panel de tiempos"
        help="Cuántos trabajos entran por día, cuánto tarda cada paso y qué pedidos están trabados. Se calcula con los movimientos reales del tablero. En Configuración → Avisos se elige si se cuentan horas corridas o solo el horario de atención."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Tablero">
              <option value="">Todos los tableros</option>
              {data?.sectors.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="seg" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <button key={p} aria-pressed={days === p} onClick={() => setDays(p)}>
                  {p} días
                </button>
              ))}
            </div>
          </div>
        }
      />
      {error && <p className="error">{error}</p>}

      <div className="kpis">
        <Kpi label={`Entraron en ${days} días`} value={data ? String(data.totals.created) : "…"} icon={ClipboardList} />
        <Kpi label="En el taller ahora" value={data ? String(data.totals.open) : "…"} icon={Factory} foot="sin contar los listos para retirar" />
        <Kpi label="Demorados" value={data ? String(data.totals.delayed) : "…"} icon={AlertTriangle} foot={`más de ${data?.delayedHours ?? "…"} h en el mismo paso`} />
      </div>

      {empty && (
        <section className="panel">
          <div className="empty" style={{ padding: 48, gap: 10 }}>
            <Timer size={32} aria-hidden />
            <strong style={{ color: "var(--color-text)", fontSize: 15 }}>Todavía no hay tiempos para mostrar</strong>
            <span>Cuando los pedidos empiecen a moverse por el tablero, acá vas a ver cuánto tarda cada paso.</span>
          </div>
        </section>
      )}

      {data && !empty && (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Trabajos por día{sector ? ` · ${sector}` : ""}</h2>
            </div>
            <div className="panel-body">
              <div className="day-bars" style={{ gridTemplateColumns: `repeat(${perDay.length}, minmax(0, 1fr))` }}>
                {perDay.map((d) => (
                  <div key={d.date} className="day-bar" title={`${shortDay(d.date)}: ${d.count} ${d.count === 1 ? "trabajo" : "trabajos"}`}>
                    <span className="day-count">{d.count > 0 && perDay.length <= 30 ? d.count : ""}</span>
                    <span className="day-fill" data-empty={d.count === 0} style={{ height: `${(d.count / maxDay) * 100}%` }} />
                    <span className="day-label">{perDay.length <= 14 || d.date.endsWith("-01") || d === perDay[perDay.length - 1] ? shortDay(d.date) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2>Por tablero</h2>
              </div>
              <div className="panel-body" style={{ display: "grid", gap: 12 }}>
                {bySector.map((s) => (
                  <div key={s.name} className="hbar">
                    <strong>{s.name}</strong>
                    <span className="hbar-track">{s.count > 0 && <i style={{ width: `${(s.count / maxSector) * 100}%` }} />}</span>
                    <span className="mono">{s.count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Por máquina</h2>
              </div>
              <div className="panel-body" style={{ display: "grid", gap: 12 }}>
                {data.perMachine.map((m) => (
                  <div key={m.machine} className="hbar">
                    <strong>{m.machine}</strong>
                    <span className="hbar-track"><i style={{ width: `${(m.count / maxMachine) * 100}%` }} /></span>
                    <span className="mono">{m.count}</span>
                  </div>
                ))}
                {data.perMachine.length === 0 && <div className="empty">No entraron trabajos en el período.</div>}
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Tiempo promedio en cada paso</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Tablero</th>
                    <th>Paso</th>
                    <th className="num">Promedio</th>
                    <th className="num">Pedidos medidos</th>
                  </tr>
                </thead>
                <tbody>
                  {averages.map((r) => (
                    <tr key={`${r.sector}-${r.status}`}>
                      <td>{r.sector}</td>
                      <td>{JOB_STATUS_LABELS[r.status]}</td>
                      <td className="num cell-title">{duration(r.avgHours)}</td>
                      <td className="num">{r.count}</td>
                    </tr>
                  ))}
                  {averages.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty" style={{ padding: 24 }}>Todavía ningún pedido pasó de un paso al siguiente en este período.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Pedidos demorados</h2>
              {delayed.length > 0 && <Badge tone="warn">más de {data.delayedHours} h en el mismo paso</Badge>}
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Tablero</th>
                    <th>Máquina</th>
                    <th>Paso actual</th>
                    <th className="num">Tiempo en el paso</th>
                  </tr>
                </thead>
                <tbody>
                  {delayed.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">
                        <Link href={`/produccion/${d.sectorCode}`}>{d.number}</Link>
                      </td>
                      <td>{d.customer}</td>
                      <td>{d.sector}</td>
                      <td>{d.machine ?? <span className="muted">—</span>}</td>
                      <td><Badge tone="info">{JOB_STATUS_LABELS[d.status]}</Badge></td>
                      <td className="num"><Badge tone="warn">{duration(d.hours)}</Badge></td>
                    </tr>
                  ))}
                  {delayed.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty" style={{ padding: 24 }}>No hay pedidos demorados.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.totals.delayed > data.delayed.length && (
              <p className="muted" style={{ margin: 0, padding: "10px 16px" }}>
                Se muestran los {data.delayed.length} más viejos de {data.totals.delayed}.
              </p>
            )}
            <p className="muted" style={{ margin: 0, padding: "10px 16px" }}>
              Se cuentan {data.businessHoursOnly ? "solo las horas del horario de atención" : "horas corridas"}. El límite y la forma de contar los cambia el dueño en Configuración → Avisos.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
