"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CUSTOMER_STATUS_LABELS, TAX_CONDITION_LABELS, type CustomerStatus } from "@viavinilo/contracts";
import { api, ApiError } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";
import { formatDni, formatPhone, fullName, STATUS_TONE, type CustomerPage } from "./customer";

const TABS: { label: string; status?: CustomerStatus }[] = [
  { label: "Todos" },
  { label: "Activos", status: "ACTIVE" },
  { label: "Altas pendientes", status: "PENDING" },
  { label: "Bloqueados", status: "BLOCKED" },
];

export default function CustomersPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomerPage | null>(null);
  const [error, setError] = useState("");

  // Busca medio segundo después de que dejan de escribir.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [query, tab]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (query) params.set("search", query);
    const status = TABS[tab]?.status;
    if (status) params.set("status", status);
    let cancelled = false;
    api<CustomerPage>(`/customers?${params}`)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "No pudimos cargar los clientes"));
    return () => {
      cancelled = true;
    };
  }, [page, query, tab]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <PageHead
        title="Clientes"
        help={
          <>
            Los clientes no se dan de alta solos: escriben por WhatsApp y un asesor los carga acá con todos sus datos.
            Con cualquiera de sus emails entran a la app con un código. Las <b>altas pendientes</b> son
            remitentes de mails que todavía no son clientes: completá la ficha y aprobala para liberar sus trabajos.
          </>
        }
        actions={
          <Link href="/ventas/clientes/nuevo" className="btn btn-primary">
            <Plus size={16} /> Nuevo cliente
          </Link>
        }
      />

      <section className="panel">
        <div className="filters">
          <div className="seg">
            {TABS.map((t, i) => (
              <button key={t.label} aria-pressed={i === tab} onClick={() => setTab(i)}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="search" style={{ marginLeft: "auto" }}>
            <Search size={16} aria-hidden />
            <input
              placeholder="Nombre, N.º de cliente, DNI, email o teléfono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar clientes"
            />
          </label>
        </div>

        {error && <p className="error" style={{ padding: "0 16px" }}>{error}</p>}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="num">N.º</th>
                <th>Cliente</th>
                <th>DNI</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Condición IVA</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((c) => (
                <tr key={c.id} className="row-link" onClick={() => router.push(`/ventas/clientes/${c.id}`)}>
                  <td className="num mono">{c.customerNumber}</td>
                  <td>
                    <Link href={`/ventas/clientes/${c.id}`} className="cell-title" onClick={(e) => e.stopPropagation()}>
                      {fullName(c)}
                    </Link>
                    {c.businessName && <div className="cell-sub">{c.businessName}</div>}
                  </td>
                  <td className="mono">{c.dni ? formatDni(c.dni) : "—"}</td>
                  <td>{c.emails[0]?.email ?? "—"}</td>
                  <td className="mono">{c.phones[0] ? formatPhone(c.phones[0].phone) : "—"}</td>
                  <td>{c.taxCondition ? TAX_CONDITION_LABELS[c.taxCondition] : "—"}</td>
                  <td>
                    <Badge tone={STATUS_TONE[c.status]}>{CUSTOMER_STATUS_LABELS[c.status]}</Badge>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty" style={{ padding: 32 }}>
                      {query ? "No encontramos clientes con esa búsqueda." : "Todavía no hay clientes en esta lista."}
                    </div>
                  </td>
                </tr>
              )}
              {!data && !error && (
                <tr>
                  <td colSpan={7}>
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
              {data.total} {data.total === 1 ? "cliente" : "clientes"}
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
