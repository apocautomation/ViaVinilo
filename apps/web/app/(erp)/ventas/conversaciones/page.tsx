"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Mail, MessagesSquare, Search, Send, Smartphone } from "lucide-react";
import { JOB_STATUS_LABELS, type JobStatus } from "@viavinilo/contracts";
import { api, ApiError } from "../../../lib/api";
import { Help } from "../../help";
import { Badge, ars } from "../../ui";

/**
 * Bandeja de Conversaciones (D-041, D-045): un hilo por cliente con el chat de la app y los mails
 * de las casillas de los sectores. El asesor responde por la app o por mail, desde la casilla del
 * sector y en el mismo hilo del mail del cliente.
 */
type Channel = "APP" | "MAIL";
const FILTERS = [
  { label: "Todas", value: "ALL" },
  { label: "Sin leer", value: "UNREAD" },
  { label: "App", value: "APP" },
  { label: "Mail", value: "MAIL" },
] as const;
/** Cada cuánto se refresca la bandeja (hasta tener avisos en vivo). */
const REFRESH_MS = 10_000;

interface CustomerRef {
  id: string;
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  status: "PENDING" | "ACTIVE" | "BLOCKED";
}
interface ConversationRow {
  id: string;
  customer: CustomerRef | null;
  contactEmail: string | null;
  contactName: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  staffUnread: number;
  lastChannel: Channel | null;
}
interface Message {
  id: string;
  direction: "IN" | "OUT";
  channel: Channel;
  subject: string | null;
  body: string;
  attachments: string[] | null;
  jobId: string | null;
  fromEmail: string | null;
  createdAt: string;
  sector: { name: string } | null;
  author: { name: string } | null;
}
interface Thread {
  id: string;
  customer: (CustomerRef & { emails: { email: string }[]; phones: { phone: string }[]; internalNotes: string | null; appPasswordSetAt: string | null }) | null;
  contactEmail: string | null;
  contactName: string | null;
  messages: Message[];
  jobs: { id: string; label: string; status: JobStatus; description: string | null; quotedAmount: string | null; sector: { name: string } }[];
}

const nameOf = (c: { customer: CustomerRef | null; contactName: string | null; contactEmail: string | null }) =>
  c.customer
    ? [c.customer.firstName, c.customer.lastName].filter(Boolean).join(" ") || c.customer.businessName || `Cliente N.º ${c.customer.customerNumber}`
    : c.contactName || c.contactEmail || "Sin nombre";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Algo salió mal. Probá de nuevo.");

function Composer({ thread, onSent }: { thread: Thread; onSent: () => void }) {
  const lastIn = [...thread.messages].reverse().find((m) => m.direction === "IN");
  const canApp = thread.customer?.status === "ACTIVE";
  const [channel, setChannel] = useState<Channel>(canApp && lastIn?.channel !== "MAIL" ? "APP" : "MAIL");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/conversations/${thread.id}/messages`, { method: "POST", body: JSON.stringify({ text, channel }) });
      setText("");
      onSent();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const lastMail = [...thread.messages].reverse().find((m) => m.direction === "IN" && m.channel === "MAIL");
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-channels">
        <div className="seg">
          <button type="button" aria-pressed={channel === "APP"} disabled={!canApp} onClick={() => setChannel("APP")}>
            <Smartphone size={14} /> Por la app
          </button>
          <button type="button" aria-pressed={channel === "MAIL"} onClick={() => setChannel("MAIL")}>
            <Mail size={14} /> Por mail
          </button>
        </div>
        <span className="muted composer-hint">
          {channel === "APP"
            ? "Lo ve en la pestaña Chat de la app."
            : lastMail
              ? `Sale desde la casilla de ${lastMail.sector?.name ?? "Via Vinilo"}, en el mismo hilo de su mail.`
              : "Sale desde la casilla de soporte."}
        </span>
      </div>
      <div className="composer-row">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(e);
            }
          }}
          placeholder="Escribí una respuesta… (Enter envía, Shift+Enter baja de línea)"
          aria-label="Respuesta"
        />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          <Send size={16} /> Enviar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default function ConversacionesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ConversationRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter, pageSize: "50" });
    if (query) params.set("search", query);
    try {
      setList((await api<{ items: ConversationRow[] }>(`/conversations?${params}`)).items);
    } catch (e) {
      setError(errorText(e));
    }
  }, [filter, query]);

  const loadThread = useCallback(async (id: string, markRead: boolean) => {
    try {
      setThread(await api<Thread>(`/conversations/${id}`));
      if (markRead) await api(`/conversations/${id}/read`, { method: "POST" });
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    void loadThread(selected, true).then(loadList);
    const t = setInterval(() => void loadThread(selected, false), REFRESH_MS);
    return () => clearInterval(t);
  }, [selected, loadThread, loadList]);

  // Chrome nuevo devuelve una promesa en scrollIntoView: no se devuelve desde el efecto.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  return (
    <div className="inbox">
      <aside className="inbox-list" aria-label="Conversaciones">
        <div className="inbox-list-head">
          <h1>
            <span style={{ display: "flex", alignItems: "center" }}>
              Conversaciones
              <Help label="Qué es Conversaciones">
                Un hilo por cliente con todo lo que manda: el chat de la app y los mails a las casillas de cada sector
                (con o sin archivo). Si trae un trabajo, el pedido ya está creado y se ve a la derecha. Respondé por la
                app o por mail: el mail sale desde la casilla del sector y en el mismo hilo.
              </Help>
            </span>
          </h1>
          <label className="search" style={{ width: "100%" }}>
            <Search size={15} aria-hidden />
            <input
              placeholder="Buscar cliente, N.º o email…"
              aria-label="Buscar conversación"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f.value} className="fchip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chats" role="listbox">
          {list?.map((c) => {
            const name = nameOf(c);
            return (
              <button key={c.id} className="chat-row" role="option" aria-selected={c.id === selected} onClick={() => setSelected(c.id)}>
                <span className="avatar">{initials(name)}</span>
                <span style={{ minWidth: 0, display: "grid", gap: 3 }}>
                  <span className="name">{name}</span>
                  <span className="last">{c.lastMessagePreview || "—"}</span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {c.lastChannel && <span className={`mini-tag ${c.lastChannel === "APP" ? "tag-app" : "tag-mail"}`}>{c.lastChannel === "APP" ? "App" : "Mail"}</span>}
                    {!c.customer && <span className="mini-tag tag-human">No es cliente</span>}
                    {c.customer?.status === "PENDING" && <span className="mini-tag tag-human">Alta pendiente</span>}
                  </span>
                </span>
                <span className="meta">
                  {when(c.lastMessageAt)}
                  {c.staffUnread > 0 && <span className="unread">{c.staffUnread}</span>}
                </span>
              </button>
            );
          })}
          {list && list.length === 0 && (
            <div className="empty" style={{ padding: 32 }}>
              {query || filter !== "ALL" ? "No hay conversaciones con ese filtro." : "Todavía no hay conversaciones."}
            </div>
          )}
          {error && <p className="error" style={{ padding: 16 }}>{error}</p>}
        </div>
      </aside>

      {thread && selected ? (
        <>
          <section className="thread">
            <div className="thread-head">
              <span className="avatar">{initials(nameOf(thread))}</span>
              <span className="title">
                <strong>{nameOf(thread)}</strong>
                <small>
                  {thread.customer
                    ? `Cliente N.º ${thread.customer.customerNumber}${thread.customer.businessName ? ` · ${thread.customer.businessName}` : ""}`
                    : `${thread.contactEmail} · todavía no es cliente`}
                </small>
              </span>
            </div>
            <div className="messages">
              {thread.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.direction === "IN" ? "in" : "out"}`}>
                  <span className="by">
                    {m.channel === "MAIL" ? <Mail size={12} /> : <Smartphone size={12} />}
                    {m.direction === "OUT" ? (m.author?.name ?? "Via Vinilo") : m.channel === "MAIL" ? (m.fromEmail ?? "Mail") : "App"}
                    {m.channel === "MAIL" && m.sector && ` · ${m.sector.name}`}
                  </span>
                  {m.subject && <strong className="bubble-subject">{m.subject}</strong>}
                  <div className="bubble-body">{m.body}</div>
                  {m.attachments?.map((f) => (
                    <div key={f} className="file-att">
                      <FileText size={15} aria-hidden /> {f}
                    </div>
                  ))}
                  {m.jobId && <span className="bubble-job">Pedido creado</span>}
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <Composer key={thread.id} thread={thread} onSent={() => void loadThread(thread.id, false).then(loadList)} />
          </section>

          <aside className="context">
            {thread.customer ? (
              <div className="ctx-card">
                <h3>Cliente</h3>
                <dl className="kv">
                  <dt>N.º</dt>
                  <dd>{thread.customer.customerNumber}</dd>
                  <dt>Estado</dt>
                  <dd>
                    <Badge tone={thread.customer.status === "ACTIVE" ? "ok" : thread.customer.status === "PENDING" ? "warn" : "bad"}>
                      {thread.customer.status === "ACTIVE" ? "Activo" : thread.customer.status === "PENDING" ? "Alta pendiente" : "Bloqueado"}
                    </Badge>
                  </dd>
                  <dt>Email</dt>
                  <dd>{thread.customer.emails[0]?.email ?? "Falta"}</dd>
                  <dt>App</dt>
                  <dd>{thread.customer.appPasswordSetAt ? "Activa" : "Sin acceso"}</dd>
                </dl>
                {thread.customer.internalNotes && <p className="muted ctx-notes">{thread.customer.internalNotes}</p>}
                <Link href={`/ventas/clientes/${thread.customer.id}`} className="btn btn-ghost">
                  Ver ficha
                </Link>
              </div>
            ) : (
              <div className="ctx-card">
                <h3>Todavía no es cliente</h3>
                <p className="muted">Si es del gremio, dalo de alta en Clientes con este email y el hilo queda en su ficha.</p>
                <Link href="/ventas/clientes/nuevo" className="btn btn-ghost">
                  Dar de alta
                </Link>
              </div>
            )}
            <div className="ctx-card">
              <h3>Pedidos</h3>
              {thread.jobs.length === 0 && <p className="muted">Sin pedidos todavía.</p>}
              {thread.jobs.map((j) => (
                <div key={j.id} className="order-mini">
                  <span className="mono">{j.label}</span>
                  <span className="muted">
                    {j.sector.name}
                    {j.description ? ` · ${j.description}` : ""}
                  </span>
                  <span>
                    <Badge tone="info">{JOB_STATUS_LABELS[j.status]}</Badge>
                    {j.quotedAmount && <span className="mono"> {ars.format(Number(j.quotedAmount))}</span>}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </>
      ) : (
        <section className="thread" style={{ gridColumn: "2 / -1" }}>
          <div className="empty inbox-placeholder">
            <MessagesSquare size={36} aria-hidden />
            <strong>Elegí una conversación</strong>
            <span className="channels">
              <span>
                <Smartphone size={15} aria-hidden /> Chat de la app
              </span>
              <span>
                <Mail size={15} aria-hidden /> Mails a las casillas de cada sector
              </span>
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
