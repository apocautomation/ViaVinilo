"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, ClipboardList, Factory, FileWarning, HandCoins, Hourglass, PackageCheck, Receipt, Truck } from "lucide-react";
import { JOB_STATUS_LABELS, parseSaltaDateTime, type JobStatus } from "@viavinilo/contracts";
import { api } from "../../lib/api";
import { useApiQuery } from "../hooks";
import { Badge, Kpi, PageHead, ars } from "../ui";

/** Límite de "demorado" mientras carga el configurado (Configuración → Avisos). */
const DEFAULT_LATE_HOURS = 24;

interface Counts {
  toQuote: number;
  fileError: number;
  waitingDeposit: number;
  inProduction: number;
  ready: number;
}
interface Summary {
  from: string;
  to: string;
  period: { entered: number; delivered: number };
  now: Counts;
  perBoard: ({ code: string; name: string } & Counts)[];
  canSeeAmounts: boolean;
  amounts: { quoted: string; quotedCount: number; delivered: string; deposits: string } | null;
  conversations: { unread: number; latest: { id: string; name: string; preview: string | null; at: string | null; unread: number }[] } | null;
}
interface LateJob {
  id: string;
  number: string;
  customer: string;
  sector: string;
  status: JobStatus;
  hours: number;
}

/** Franjas del gráfico, en el orden del proceso. */
const BANDS: { key: keyof Counts; label: string; color: string }[] = [
  { key: "toQuote", label: "Para cotizar", color: "var(--color-brand-500)" },
  { key: "fileError", label: "Con error", color: "var(--color-danger)" },
  { key: "waitingDeposit", label: "Esperando seña", color: "var(--color-warning)" },
  { key: "inProduction", label: "En producción", color: "var(--color-navy-500)" },
  { key: "ready", label: "Listo", color: "var(--color-success-500)" },
];

const TZ = "America/Argentina/Salta";
const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const showDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const when = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const PRESETS = [
  { value: "today", label: "Hoy" },
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Elegir fechas" },
] as const;
type Preset = (typeof PRESETS)[number]["value"];

function rangeOf(preset: Preset, custom: { from: string; to: string }): { from: string; to: string } | null {
  const today = isoDay(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "7" || preset === "30") return { from: isoDay(new Date(Date.now() - (Number(preset) - 1) * 864e5)), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  const from = parseSaltaDateTime(custom.from)?.slice(0, 10);
  const to = parseSaltaDateTime(custom.to || custom.from)?.slice(0, 10);
  return from && to && from <= to ? { from, to } : null;
}

/** 3,5 → "3 h 30 min"; 30 → "1 d 6 h". */
function hoursText(hours: number): string {
  const min = Math.round(hours * 60);
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
  return `${Math.floor(min / (24 * 60))} d ${Math.floor((min % (24 * 60)) / 60)} h`;
}

/**
 * Inicio (D-089). Separa dos cosas que antes estaban mezcladas: la foto del taller ahora (cuántos
 * pedidos hay en cada paso) y los números del período elegido (entraron, se entregaron y, para quien
 * tiene permiso, los totales en pesos). Los cálculos los hace la API.
 */
export default function InicioPage() {
  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [sector, setSector] = useState("");
  const [sectors, setSectors] = useState<{ code: string; name: string }[]>([]);
  const [lateHours, setLateHours] = useState(DEFAULT_LATE_HOURS);
  const [late, setLate] = useState<LateJob[]>([]);
  const [lateTotal, setLateTotal] = useState(0);

  useEffect(() => {
    api<{ code: string; name: string }[]>("/sectors").then(setSectors).catch(() => undefined);
    // Mismo cálculo que el Panel de tiempos: mismo límite y misma forma de contar las horas (D-073).
    api<{ delayedHours: number; totals: { delayed: number }; delayed: LateJob[] }>("/jobs/times?days=1")
      .then((r) => (setLateHours(r.delayedHours), setLate(r.delayed), setLateTotal(r.totals.delayed)))
      .catch(() => undefined);
  }, []);

  const range = rangeOf(preset, custom);
  const summaryParams = range ? new URLSearchParams({ from: range.from, to: range.to, ...(sector ? { sector } : {}) }) : null;
  const { data, error } = useApiQuery<Summary>(summaryParams && `/jobs/summary?${summaryParams}`, "No pudimos cargar el resumen");

  const n = (v: number | undefined) => (data ? String(v ?? 0) : "…");
  const money = (v: string | undefined) => (data ? ars.format(Number(v ?? 0)) : "…");
  const periodLabel = data ? (data.from === data.to ? showDay(data.from) : `${showDay(data.from)} al ${showDay(data.to)}`) : "";
  const totalOf = (c: Counts) => c.toQuote + c.fileError + c.waitingDeposit + c.inProduction + c.ready;
  const max = Math.max(1, ...(data?.perBoard.map(totalOf) ?? []));

  return (
    <div className="page">
      <PageHead
        title="Inicio"
        help="Arriba, cómo está el taller en este momento: cuántos pedidos hay en cada paso. Abajo, los números del período que elijas: cuántos entraron y cuántos se entregaron. Los totales en pesos los ve el dueño y quien tenga el permiso en Configuración → Usuarios."
      />

      <div className="filters" style={{ padding: 0 }}>
        <div className="seg">
          {PRESETS.map((p) => (
            <button key={p.value} aria-pressed={preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <input value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} placeholder="Desde · 01/11/2026" maxLength={10} inputMode="numeric" aria-label="Desde" style={{ width: 150 }} />
            <input value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} placeholder="Hasta · 24/11/2026" maxLength={10} inputMode="numeric" aria-label="Hasta" style={{ width: 150 }} />
          </>
        )}
        <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option value="">Todos los sectores</option>
          {sectors.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        {preset === "custom" && !range && <span className="muted" style={{ fontSize: 13 }}>Escribí las fechas como día/mes/año.</span>}
      </div>
      {error && <p className="error">{error}</p>}

      <h2 className="home-title">En el taller ahora</h2>
      <div className="kpis">
        <Kpi label="Para cotizar" value={n(data?.now.toQuote)} icon={ClipboardList} foot="archivo recibido, sin precio" />
        <Kpi label="Con error de archivo" value={n(data?.now.fileError)} icon={FileWarning} foot="esperando al cliente" />
        <Kpi label="Esperando seña" value={n(data?.now.waitingDeposit)} icon={Hourglass} foot="cotizados, sin seña" />
        <Kpi label="En producción" value={n(data?.now.inProduction)} icon={Factory} foot="cotizados o con seña, hasta terminar" />
        <Kpi label="Listos para retirar" value={n(data?.now.ready)} icon={PackageCheck} />
        <Kpi label="Demorados" value={String(lateTotal)} icon={AlertTriangle} foot={`más de ${lateHours} h en el mismo paso`} />
      </div>

      <h2 className="home-title">
        Período <span className="muted">· {periodLabel}</span>
      </h2>
      <div className="kpis">
        <Kpi label="Pedidos que entraron" value={n(data?.period.entered)} icon={ClipboardList} />
        <Kpi label="Pedidos entregados" value={n(data?.period.delivered)} icon={Truck} />
        {data?.canSeeAmounts && (
          <>
            <Kpi label="Total entregado" value={money(data.amounts?.delivered)} icon={Receipt} foot="precio de los pedidos entregados" />
            <Kpi label="Total cotizado" value={money(data.amounts?.quoted)} icon={Banknote} foot={`${data.amounts?.quotedCount ?? 0} pedidos cotizados`} />
            <Kpi label="Señas registradas" value={money(data.amounts?.deposits)} icon={HandCoins} />
          </>
        )}
      </div>
      {data?.canSeeAmounts && (
        <p className="muted" style={{ fontSize: 12.5, margin: "-4px 0 0" }}>
          Los totales salen de los precios cotizados. Todavía no hay facturación ni registro de cobros (Etapa 3), así que «Total entregado» es lo que corresponde facturar, no lo cobrado.
        </p>
      )}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Pedidos en curso por sector</h2>
            <div className="chips">
              {BANDS.map((b) => (
                <span key={b.key} className="chip">
                  <i style={dot(b.color)} /> {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 14 }}>
            {data?.perBoard.map((s) => {
              const total = totalOf(s);
              return (
                <Link key={s.code} href={`/produccion/${s.code}`} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 12, alignItems: "center", color: "inherit", textDecoration: "none" }}>
                  <strong style={{ fontSize: 13 }}>{s.name}</strong>
                  <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--color-neutral-100)", width: total ? `${Math.max(4, (total / max) * 100)}%` : "100%" }}>
                    {BANDS.map((b) => (
                      <span key={b.key} title={`${b.label}: ${s[b.key]}`} style={{ flex: s[b.key], background: b.color }} />
                    ))}
                  </div>
                  <span className="mono" style={{ textAlign: "right", color: "var(--color-text)" }}>{total}</span>
                </Link>
              );
            })}
            {data && data.perBoard.length === 0 && <div className="empty">No hay sectores para mostrar.</div>}
          </div>
        </section>

        {data?.conversations && (
          <section className="panel">
            <div className="panel-head">
              <h2>
                Conversaciones sin leer {data.conversations.unread > 0 && <Badge tone="warn">{data.conversations.unread}</Badge>}
              </h2>
              <Link href="/ventas/conversaciones" style={{ fontSize: 12.5, fontWeight: 600 }}>Ver todas</Link>
            </div>
            {data.conversations.latest.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>No hay conversaciones sin leer.</div>
            ) : (
              <ul className="home-chats">
                {data.conversations.latest.map((c) => (
                  <li key={c.id}>
                    <Link href="/ventas/conversaciones">
                      <span className="home-chat-top">
                        <strong>{c.name}</strong>
                        <small className="muted">{c.at ? when.format(new Date(c.at)) : ""}</small>
                      </span>
                      <span className="home-chat-preview">{c.preview || "—"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
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
              {late.length === 0 && (
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
