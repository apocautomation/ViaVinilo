"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobListItem, JobStatus, SectorRef } from "@viavinilo/contracts";
import { api } from "../../../lib/api";
import { useApiQuery, useDebounced } from "../../hooks";
import { Badge, PageHead, SearchBox, TableFoot, TableMessage, ars, type Tone } from "../../ui";

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

const customerName = (c: JobListItem["customer"]) =>
  c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.businessName || `Cliente N.º ${c.customerNumber}` : "—";

function deposit(j: JobListItem): { text: string; tone: Tone } | null {
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
  const query = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [sectors, setSectors] = useState<SectorRef[]>([]);

  useEffect(() => {
    api<SectorRef[]>("/sectors").then(setSectors).catch(() => undefined);
  }, []);
  useEffect(() => setPage(1), [tab, sector, source, query]);

  const params = new URLSearchParams({ tab, page: String(page), pageSize: "30" });
  if (sector) params.set("sector", sector);
  if (source) params.set("source", source);
  if (query) params.set("search", query);
  const { data, error } = useApiQuery<{ total: number; pageSize: number; items: JobListItem[] }>(`/jobs?${params}`, "No pudimos cargar los pedidos");

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
          <SearchBox pushRight placeholder="N.º de pedido, cliente o detalle" value={search} onChange={setSearch} label="Buscar pedidos" />
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
                <TableMessage colSpan={10}>{query || sector || source ? "No hay pedidos con ese filtro." : "Todavía no hay pedidos en esta lista."}</TableMessage>
              )}
              {!data && !error && <TableMessage colSpan={10}>Cargando…</TableMessage>}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && <TableFoot total={data.total} noun={["pedido", "pedidos"]} page={page} pageSize={data.pageSize} onPage={setPage} />}
      </section>
    </div>
  );
}
