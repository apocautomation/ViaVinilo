"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, Factory, PackageCheck } from "lucide-react";
import { JOB_STATUS_LABELS, type JobStatus } from "@viavinilo/contracts";
import { api } from "../../lib/api";
import { Badge, Kpi, PageHead } from "../ui";

/** Igual que el tablero (D-030): más de 2 h en el mismo paso es una demora. */
/** Límite de "demorado" mientras carga el configurado (Configuración → Avisos). */
const DEFAULT_LATE_HOURS = 24;

interface Card {
  id: string;
  number: number;
  status: JobStatus;
  customer: { name: string | null };
  createdAt: string;
  updatedAt: string;
}
interface Board {
  sector: { code: string; name: string };
  columns: { status: JobStatus; cards: Card[] }[];
}

/** Agrupa los estados en las 4 franjas del gráfico. */
const BAND: Partial<Record<JobStatus, "received" | "quoted" | "printing" | "ready">> = {
  PENDING_SIGNUP: "received",
  RECEIVED: "received",
  FILE_ERROR: "received",
  QUOTED: "quoted",
  DEPOSIT_RECEIVED: "quoted",
  PRINTED: "printing",
  CALENDERING: "printing",
  READY: "ready",
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

interface LateJob {
  id: string;
  number: string;
  customer: string;
  sector: string;
  status: JobStatus;
  hours: number;
}

/** 3,5 → "3 h 30 min"; 30 → "1 d 6 h". */
function hoursText(hours: number): string {
  const min = Math.round(hours * 60);
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
  return `${Math.floor(min / (24 * 60))} d ${Math.floor((min % (24 * 60)) / 60)} h`;
}

/** Inicio con los datos reales de los tableros (D-045): sin datos de ejemplo. */
export default function InicioPage() {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [lateHours, setLateHours] = useState(DEFAULT_LATE_HOURS);
  const [late, setLate] = useState<LateJob[]>([]);
  const [lateTotal, setLateTotal] = useState(0);

  useEffect(() => {
    api<{ code: string }[]>("/sectors")
      .then((sectors) => Promise.all(sectors.map((s) => api<Board>(`/jobs/board?sector=${s.code}`))))
      .then(setBoards)
      .catch(() => setBoards([]));
    // Mismo cálculo que el Panel de tiempos: mismo límite y misma forma de contar las horas (D-073).
    api<{ delayedHours: number; totals: { delayed: number }; delayed: LateJob[] }>("/jobs/times?days=1")
      .then((r) => (setLateHours(r.delayedHours), setLate(r.delayed), setLateTotal(r.totals.delayed)))
      .catch(() => undefined);
  }, []);

  const cards = (boards ?? []).flatMap((b) =>
    b.columns.flatMap((c) => c.cards.map((card) => ({ ...card, sector: b.sector.name }))),
  );
  const active = cards.filter((c) => BAND[c.status]);
  const perSector = (boards ?? []).map((b) => {
    const counts = { received: 0, quoted: 0, printing: 0, ready: 0 };
    for (const col of b.columns) {
      const band = BAND[col.status];
      if (band) counts[band] += col.cards.length;
    }
    return { name: b.sector.name, ...counts };
  });
  const max = Math.max(1, ...perSector.map((s) => s.received + s.quoted + s.printing + s.ready));
  const loading = boards === null;
  const n = (v: number) => (loading ? "…" : String(v));

  return (
    <div className="page">
      <PageHead
        title="Inicio"
        help="Resumen del día con los datos reales de los tableros: pedidos que entraron hoy, en producción, listos para retirar y trabajos demorados (el límite de horas se cambia en Configuración)."
      />

      <div className="kpis">
        <Kpi label="Pedidos de hoy" value={n(cards.filter((c) => isToday(c.createdAt)).length)} icon={ClipboardList} />
        <Kpi label="En producción" value={n(active.filter((c) => c.status !== "READY").length)} icon={Factory} />
        <Kpi label="Listos para retirar" value={n(active.filter((c) => c.status === "READY").length)} icon={PackageCheck} />
        <Kpi label="Demorados" value={n(lateTotal)} icon={AlertTriangle} foot={`más de ${lateHours} h en el mismo paso`} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Producción por sector</h2>
            <div className="chips">
              <span className="chip"><i style={dot("var(--color-brand-500)")} /> Recibido</span>
              <span className="chip"><i style={dot("var(--color-accent-500)")} /> Cotizado</span>
              <span className="chip"><i style={dot("var(--color-navy-500)")} /> Impreso</span>
              <span className="chip"><i style={dot("var(--color-success-500)")} /> Listo</span>
            </div>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 14 }}>
            {perSector.map((s) => {
              const total = s.received + s.quoted + s.printing + s.ready;
              return (
                <div key={s.name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 12, alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{s.name}</strong>
                  <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--color-neutral-100)", width: total ? `${(total / max) * 100}%` : "100%" }}>
                    <span style={{ flex: s.received, background: "var(--color-brand-500)" }} />
                    <span style={{ flex: s.quoted, background: "var(--color-accent-500)" }} />
                    <span style={{ flex: s.printing, background: "var(--color-navy-500)" }} />
                    <span style={{ flex: s.ready, background: "var(--color-success-500)" }} />
                  </div>
                  <span className="mono" style={{ textAlign: "right", color: "var(--color-text)" }}>{total}</span>
                </div>
              );
            })}
            {!loading && perSector.length === 0 && <div className="empty">No hay sectores para mostrar.</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Conversaciones</h2>
            <Link href="/ventas/conversaciones" style={{ fontSize: 12.5, fontWeight: 600 }}>Ver todas</Link>
          </div>
          <div className="empty" style={{ padding: 32 }}>
            Todavía no hay conversaciones. Acá van a aparecer los mensajes del chat de la app y los mails de las casillas
            de cada sector.
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Trabajos demorados</h2>
          {lateTotal > 0 && <Badge tone="warn">{lateTotal} superan las {lateHours} h en el mismo paso</Badge>}
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Sector</th>
                <th>Paso actual</th>
                <th className="num">Tiempo en el paso</th>
              </tr>
            </thead>
            <tbody>
              {late.slice(0, 10).map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.number}</td>
                  <td>{l.customer}</td>
                  <td>{l.sector}</td>
                  <td><Badge tone="info">{JOB_STATUS_LABELS[l.status]}</Badge></td>
                  <td className="num"><Badge tone="warn">{hoursText(l.hours)}</Badge></td>
                </tr>
              ))}
              {!loading && late.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty" style={{ padding: 24 }}>No hay trabajos demorados.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function dot(color: string) {
  return { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color } as const;
}
