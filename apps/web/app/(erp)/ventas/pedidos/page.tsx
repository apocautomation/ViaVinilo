"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { JobStatus } from "@viavinilo/contracts";
import { api, ApiError } from "../../../lib/api";
import { Badge, PageHead, ars, type Tone } from "../../ui";

/** Pedidos reales de todos los sectores (sin datos de ejemplo). */
const TABS = [
  { label: "En curso", value: "ACTIVE" },
  { label: "Listos para retirar", value: "READY" },
  { label: "Entregados", value: "DELIVERED" },
  { label: "Todos", value: "ALL" },
] as const;
const SOURCES = [
  { label: "Todos los canales", value: "" },
  { label: "Mail", value: "EMAIL" },
  { label: "App", value: "API" },
  { label: "Mostrador", value: "COUNTER" },
] as const;
const SOURCE_LABEL: Record<string, string> = { EMAIL: "Mail", API: "App", COUNTER: "Mostrador", WHATSAPP: "WhatsApp", WEB: "Web" };

const STATUS_TONE: Partial<Record<JobStatus, Tone>> = {
  FILE_ERROR: "bad",
  PENDING_SIGNUP: "warn",
  QUOTED: "warn",
  DEPOSIT_RECEIVED: "info",
  RECEIVED: "info",
  PRINTED: "info",
  CALENDERING: "info",
  READY: "ok",
  DELIVERED: "ok",
};

interface Job {
  id: string;
  label: string;
  status: JobStatus;
  statusLabel: string;
  source: string;
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  depositPaidAt: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  sector: { code: string; name: string };
  customer: { id: string; customerNumber: number; firstName: string | null; lastName: string | null; businessName: string | null } | null;
}

const customerName = (c: Job["customer"]) =>
  c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.businessName || `Cliente N.º ${c.customerNumber}` : "—";

function deposit(j: Job): { text: string; tone: Tone } | null {
  if (!j.depositRequired) return null;
  return j.depositPaidAt ? { text: "Seña recibida", tone: "ok" } : { text: "Seña pendiente", tone: "warn" };
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PedidosPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("ACTIVE");
  const [sector, setSector] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sectors, setSectors] = useState<{ code: string; name: string }[]>([]);
  const [data, setData] = useState<{ total: number; pageSize: number; items: Job[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ code: string; name: string }[]>("/sectors").then(setSectors).catch(() => undefined);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [tab, sector, source, query]);

  useEffect(() => {
    const params = new URLSearchParams({ tab, page: String(page), pageSize: "30" });
    if (sector) params.set("sector", sector);
    if (source) params.set("source", source);
    if (query) params.set("search", query);
    let cancelled = false;
    api<{ total: number; pageSize: number; items: Job[] }>(`/jobs?${params}`)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "No pudimos cargar los pedidos"));
    return () => {
      cancelled = true;
    };
  }, [tab, sector, source, query, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <PageHead
        title="Pedidos"
        help="Todos los pedidos de todos los sectores: los que entran por mail, por la app o por mostrador. Para moverlos, abrí el tablero del sector."
      />

      <section className="panel">
        <div className="filters">
          <div className="seg">
            {TABS.map((t) => (
              <button key={t.value} aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
            <option value="">Todos los sectores</option>
            {sectors.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Canal">
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="search" style={{ marginLeft: "auto" }}>
            <Search size={16} aria-hidden />
            <input placeholder="N.º de pedido, cliente o detalle" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar pedidos" />
          </label>
        </div>

        {error && <p className="error" style={{ padding: "0 16px" }}>{error}</p>}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Sector</th>
                <th>Detalle</th>
                <th>Estado</th>
                <th className="num">Importe</th>
                <th>Seña</th>
                <th>Listo para</th>
                <th>Ingresó</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((j) => {
                const d = deposit(j);
                return (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/produccion/${j.sector.code}`} className="cell-title mono">
                        {j.label}
                      </Link>
                    </td>
                    <td>
                      {j.customer ? (
                        <Link href={`/ventas/clientes/${j.customer.id}`} className="cell-title">
                          {customerName(j.customer)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{SOURCE_LABEL[j.source] ?? j.source}</td>
                    <td>{j.sector.name}</td>
                    <td>
                      {j.description ?? "—"}
                      {j.measure && <div className="cell-sub">{j.measure}</div>}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.statusLabel}</Badge>
                    </td>
                    <td className="num mono">{j.quotedAmount ? ars.format(Number(j.quotedAmount)) : "—"}</td>
                    <td>{d ? <Badge tone={d.tone}>{d.text}</Badge> : "—"}</td>
                    <td>{fmt(j.estimatedReadyAt)}</td>
                    <td className="muted">{fmt(j.createdAt)}</td>
                  </tr>
                );
              })}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty" style={{ padding: 32 }}>
                      {query || sector || source ? "No hay pedidos con ese filtro." : "Todavía no hay pedidos en esta lista."}
                    </div>
                  </td>
                </tr>
              )}
              {!data && !error && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty" style={{ padding: 32 }}>Cargando…</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="table-foot">
            <span>
              {data.total} {data.total === 1 ? "pedido" : "pedidos"}
            </span>
            <div className="pager">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <span>
                {page} de {pages}
              </span>
              <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
