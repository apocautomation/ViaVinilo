"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, Send } from "lucide-react";
import { CUSTOMER_STATUS_LABELS, TAX_CONDITION_LABELS, type CustomerGap, type CustomerStatus } from "@viavinilo/contracts";
import { api, ApiError } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";
import { appAccess, formatDni, formatPhone, fullName, STATUS_TONE, type CustomerPage } from "./customer";
import { InviteDialog } from "./invite-dialog";

const GAPS: { label: string; value: CustomerGap | "" }[] = [
  { label: "Todos", value: "" },
  { label: "Falta email", value: "NO_EMAIL" },
  { label: "Falta DNI", value: "NO_DNI" },
  { label: "Sin acceso a la app", value: "NO_APP_PASSWORD" },
];

const TABS: { label: string; status?: CustomerStatus }[] = [
  { label: "Todos" },
  { label: "Activos", status: "ACTIVE" },
  { label: "Altas pendientes", status: "PENDING" },
  { label: "Bloqueados", status: "BLOCKED" },
];

export default function CustomersPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [gap, setGap] = useState<CustomerGap | "">("");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
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
  useEffect(() => setPage(1), [query, tab, gap]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (query) params.set("search", query);
    const status = TABS[tab]?.status;
    if (status) params.set("status", status);
    if (gap) params.set("gap", gap);
    let cancelled = false;
    api<CustomerPage>(`/customers?${params}`)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "No pudimos cargar los clientes"));
    return () => {
      cancelled = true;
    };
  }, [page, query, tab, gap, reload]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <PageHead
        title="Clientes"
        help={
          <>
            Los clientes no se dan de alta solos: escriben por WhatsApp y un asesor los carga acá. Con
            <b> Invitar a la app</b> les llega un mail con un link para crear su contraseña; después entran con su email
            o su celular. A los que les falta el email no les llega: cargáselo y volvé a invitar. Las <b>altas pendientes</b> son
            remitentes de mails que todavía no son clientes: completá la ficha y aprobala para liberar sus trabajos.
          </>
        }
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setInviting(true)}>
              <Send size={16} /> Invitar a la app
            </button>
            <Link href="/ventas/clientes/nuevo" className="btn btn-primary">
              <Plus size={16} /> Nuevo cliente
            </Link>
          </>
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

        <div className="filters filters-sub">
          <span className="muted">Datos a completar:</span>
          {GAPS.map((g) => (
            <button key={g.value} className="fchip" aria-pressed={gap === g.value} onClick={() => setGap(g.value)}>
              {g.label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="notice" style={{ margin: "0 16px 12px" }}>
            <CheckCircle2 size={16} aria-hidden /> {notice}
          </div>
        )}
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
                <th>App</th>
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
                  <td>{c.emails[0]?.email ?? <Badge tone="warn">Falta email</Badge>}</td>
                  <td className="mono">{c.phones[0] ? formatPhone(c.phones[0].phone) : "—"}</td>
                  <td>{c.taxCondition ? TAX_CONDITION_LABELS[c.taxCondition] : "—"}</td>
                  <td>{appAccess(c)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[c.status]}>{CUSTOMER_STATUS_LABELS[c.status]}</Badge>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty" style={{ padding: 32 }}>
                      {query ? "No encontramos clientes con esa búsqueda." : "Todavía no hay clientes en esta lista."}
                    </div>
                  </td>
                </tr>
              )}
              {!data && !error && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty" style={{ padding: 32 }}>Cargando…</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {inviting && (
          <InviteDialog
            onClose={() => setInviting(false)}
            onDone={(msg) => {
              setInviting(false);
              setNotice(msg);
              setReload((n) => n + 1);
            }}
          />
        )}

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
