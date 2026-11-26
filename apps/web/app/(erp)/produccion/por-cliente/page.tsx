"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isPickupBranch, PICKUP_BRANCHES, PICKUP_LABELS, type JobStatus } from "@viavinilo/contracts";
import { useApiQuery, useDebounced } from "../../hooks";
import { Badge, EmptyState, Loading, PageHead, SearchBox, ars, type Tone } from "../../ui";

/**
 * Trabajos por cliente (D-084): los pedidos en curso de cada cliente, de todos los sectores juntos.
 * Lo pidió Verónica para caja: un cliente pide en Calandra, Gran Formato y DTF y hay que juntarle todo.
 */

interface Job {
  id: string;
  label: string;
  status: JobStatus;
  statusLabel: string;
  board: { code: string; name: string };
  service: string | null;
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositAmount: string | null;
  depositPending: boolean;
  estimatedReadyAt: string | null;
  pickupBranch: string | null;
  createdAt: string;
}

interface Group {
  customer: { id: string; number: number; name: string | null };
  total: number;
  ready: number;
  boards: string[];
  quotedTotal: string | null;
  jobs: Job[];
}

const STATUS_TONE: Partial<Record<JobStatus, Tone>> = {
  FILE_ERROR: "bad",
  PENDING_SIGNUP: "warn",
  QUOTED: "warn",
  RECEIVED: "info",
  DEPOSIT_RECEIVED: "info",
  PRINTED: "info",
  CALENDERING: "info",
  READY: "ok",
};

const TZ = "America/Argentina/Salta";
const when = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default function JobsByCustomerPage() {
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const [pickup, setPickup] = useState("");
  const [several, setSeveral] = useState(false);
  const [page, setPage] = useState(1);
  /** D-085: cada cliente arranca plegado; se abre con un clic. Con una búsqueda se abren todos. */
  const [opened, setOpened] = useState<Set<string>>(new Set());
  useEffect(() => setPage(1), [query, pickup, several]);
  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("search", query);
  if (pickup) params.set("pickup", pickup);
  if (several) params.set("several", "true");
  const { data, error } = useApiQuery<{ customers: Group[]; totalCustomers: number; totalJobs: number; pageSize: number }>(
    `/jobs/by-customer?${params}`,
    "No pudimos cargar los trabajos",
  );

  const groups = data?.customers ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.totalCustomers / data.pageSize)) : 1;
  const isOpen = (id: string) => opened.has(id) || (query !== "" && groups.length <= 5);

  return (
    <div className="page">
      <PageHead
        title="Trabajos por cliente"
        help="Los pedidos en curso de cada cliente, de todos los sectores juntos. Sirve para juntar lo que un cliente tiene repartido en varios tableros. Para mover un pedido, tocá su número y se abre el tablero."
      />

      <section className="panel">
        <div className="filters">
          <SearchBox placeholder="Cliente, N.º de cliente o N.º de pedido" value={search} onChange={setSearch} label="Buscar cliente" autoFocus />
          <select value={pickup} onChange={(e) => setPickup(e.target.value)} aria-label="Sucursal de retiro">
            <option value="">Retiro en cualquier sucursal</option>
            {PICKUP_BRANCHES.map((b) => (
              <option key={b} value={b}>
                Retira en {PICKUP_LABELS[b]}
              </option>
            ))}
          </select>
          <label className="toggle">
            <input type="checkbox" checked={several} onChange={(e) => setSeveral(e.target.checked)} />
            Solo con trabajos en varios sectores
          </label>
          {data && (
            <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>
              {data.totalCustomers} {data.totalCustomers === 1 ? "cliente" : "clientes"} · {data.totalJobs} {data.totalJobs === 1 ? "trabajo" : "trabajos"} en curso
            </span>
          )}
        </div>

        {error && <p className="error" style={{ padding: "0 16px" }}>{error}</p>}
        {!data && !error && <Loading />}
        {data && groups.length === 0 && <EmptyState>{query || pickup || several ? "No hay clientes con ese filtro." : "No hay trabajos en curso."}</EmptyState>}

        <div className="by-customer">
          {groups.map((g) => (
            <article key={g.customer.id} className="by-customer-card" data-open={isOpen(g.customer.id)}>
              <header>
                <button type="button" className="btn btn-ghost btn-sm icon-only" aria-expanded={isOpen(g.customer.id)} aria-label={`Ver los trabajos de ${g.customer.name ?? "este cliente"}`} onClick={() => toggle(g.customer.id)}>
                  {isOpen(g.customer.id) ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/ventas/clientes/${g.customer.id}`} className="cell-title">
                    {g.customer.name ?? "Cliente sin nombre"}
                  </Link>
                  <span className="muted"> · Cliente N.º {g.customer.number}</span>
                  <div className="cell-sub">{g.boards.join(" · ")}</div>
                </div>
                <div className="by-customer-sum">
                  {g.ready > 0 && (
                    <Badge tone="ok">
                      {g.ready} {g.ready === 1 ? "listo para retirar" : "listos para retirar"}
                    </Badge>
                  )}
                  <Badge tone={g.boards.length > 1 ? "warn" : "neutral"}>
                    {g.total} {g.total === 1 ? "trabajo" : "trabajos"}
                    {g.boards.length > 1 ? ` en ${g.boards.length} sectores` : ""}
                  </Badge>
                  {g.quotedTotal && <strong className="mono">{ars.format(Number(g.quotedTotal))}</strong>}
                </div>
              </header>
              {isOpen(g.customer.id) && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Sector</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th>Retira en</th>
                      <th className="num">Importe</th>
                      <th>Listo para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.jobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <Link href={`/produccion/${j.board.code}`} className="cell-title mono" title="Abrir el tablero">
                            {j.label}
                          </Link>
                        </td>
                        <td>
                          {j.board.name}
                          {j.service && <div className="cell-sub">{j.service}</div>}
                        </td>
                        <td>
                          {j.description ?? "—"}
                          {j.measure && <div className="cell-sub">{j.measure}</div>}
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.statusLabel}</Badge>
                        </td>
                        <td>{isPickupBranch(j.pickupBranch) ? PICKUP_LABELS[j.pickupBranch] : <span className="muted">Sin definir</span>}</td>
                        <td className="num mono">
                          {j.quotedAmount ? ars.format(Number(j.quotedAmount)) : "—"}
                          {j.depositPending && <div className="cell-sub">Seña {j.depositAmount ? ars.format(Number(j.depositAmount)) : ""} pendiente</div>}
                        </td>
                        <td>{j.estimatedReadyAt ? when.format(new Date(j.estimatedReadyAt)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </article>
          ))}
        </div>

        {data && pages > 1 && (
          <div className="pager">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span className="muted">
              Página {page} de {pages}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
