"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, BellOff, Bot, BotOff, Download, Paperclip, ExternalLink, FileText, Hand, Link2, Mail, Menu, MessagesSquare, Search, Send, SlidersHorizontal, Smartphone, X } from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  attachmentsOf,
  formatBytes,
  JOB_STATUS_LABELS,
  MAX_FILES_PER_MESSAGE,
  MAX_MAIL_ATTACHMENTS_BYTES,
  parseMailBody,
  type JobStatus,
} from "@viavinilo/contracts";
import { api, ApiError, downloadFile, getUser, upload } from "../../../lib/api";
import { Help } from "../../help";
import { Badge, ars } from "../../ui";
import { CustomerRecord } from "../clientes/customer-record";

/**
 * Bandeja de Conversaciones (D-041, D-045): un hilo por cliente con el chat de la app y los mails
 * de las casillas de los sectores. El asesor responde por la app o por mail, desde la casilla del
 * sector y en el mismo hilo del mail del cliente.
 */
type Channel = "APP" | "MAIL";
/** D-059: tres pestañas principales; el canal (App / Mail) se elige con el botón de filtros. */
const TABS = [
  { label: "Todas", value: "ALL" },
  { label: "Sin leer", value: "UNREAD" },
  { label: "Pide asesor", value: "HUMAN" },
] as const;
const CHANNELS = [
  { label: "Solo chat de la app", value: "APP" },
  { label: "Solo mails", value: "MAIL" },
] as const;
type Filter = (typeof TABS)[number]["value"] | (typeof CHANNELS)[number]["value"];
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
  botEnabled: boolean;
  needsHuman: boolean;
}
interface Message {
  id: string;
  direction: "IN" | "OUT";
  channel: Channel;
  subject: string | null;
  body: string;
  attachments: unknown;
  jobId: string | null;
  fromEmail: string | null;
  createdAt: string;
  sector: { name: string } | null;
  author: { name: string } | null;
  fromBot: boolean;
  /** Mail que vino de una casilla nuestra (un reenvío del equipo): va del lado del equipo (D-057). */
  fromStaff?: boolean;
}
interface Thread {
  id: string;
  botEnabled: boolean;
  needsHuman: boolean;
  needsHumanReason: string | null;
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

/** "recién", "hace 5 min", "hace 2 h", "ayer" o la fecha (D-059). */
function ago(iso: string) {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 12 * 60 && new Date().toDateString() === d.toDateString()) return `hace ${Math.floor(min / 60)} h`;
  const yesterday = new Date(Date.now() - 86_400_000).toDateString() === d.toDateString();
  if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return yesterday ? "ayer" : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}


const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Algo salió mal. Probá de nuevo.");

function Composer({ thread, onSent }: { thread: Thread; onSent: () => void }) {
  const lastIn = [...thread.messages].reverse().find((m) => m.direction === "IN");
  const canApp = thread.customer?.status === "ACTIVE";
  const [channel, setChannel] = useState<Channel>(canApp && lastIn?.channel !== "MAIL" ? "APP" : "MAIL");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Archivos para mandar con la respuesta (D-062). */
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const tooBigForMail = channel === "MAIL" && totalBytes > MAX_MAIL_ATTACHMENTS_BYTES;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && !files.length) return;
    if (tooBigForMail) return setError("Por mail entran hasta 20 MB de adjuntos. Mandalo por la app o en partes.");
    setBusy(true);
    setError("");
    try {
      if (files.length) {
        const form = new FormData();
        form.append("channel", channel);
        if (text.trim()) form.append("text", text);
        files.forEach((f) => form.append("files", f));
        setProgress(0);
        await upload(`/conversations/${thread.id}/files`, form, setProgress);
        setFiles([]);
      } else {
        await api(`/conversations/${thread.id}/messages`, { method: "POST", body: JSON.stringify({ text, channel }) });
      }
      setText("");
      setProgress(null);
      onSent();
    } catch (err) {
      setError(errorText(err));
      setProgress(null);
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
      {files.length > 0 && (
        <div className="composer-files">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="file-pill">
              <FileText size={13} aria-hidden /> {f.name} <small>{formatBytes(f.size)}</small>
              <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                <X size={13} />
              </button>
            </span>
          ))}
          {tooBigForMail && <span className="error">Por mail entran hasta 20 MB: mandalo por la app.</span>}
          {progress !== null && <span className="muted">Subiendo… {Math.round(progress * 100)}%</span>}
        </div>
      )}
      <div className="composer-row">
        <label className="btn btn-ghost attach-btn" title="Adjuntar archivos (hasta 5)">
          <Paperclip size={16} aria-hidden />
          <span className="sr-only">Adjuntar archivos</span>
          <input
            type="file"
            hidden
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((all) => [...all, ...picked].slice(0, MAX_FILES_PER_MESSAGE));
              e.target.value = "";
            }}
          />
        </label>
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
        <button className="btn btn-primary" disabled={busy || (!text.trim() && !files.length) || tooBigForMail}>
          <Send size={16} /> Enviar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}


interface BotStatus {
  configured: boolean;
  model: string | null;
  chatsWithBot: number;
  needsHuman: number;
}


/** Cuerpo de un mensaje (D-057): el mail tal cual, pero con los links aparte y lo citado plegado. */
function MessageBody({ m }: { m: Message }) {
  if (m.channel !== "MAIL") return <div className="bubble-body">{m.body}</div>;
  const p = parseMailBody(m.body);
  return (
    <>
      {p.text && <div className="bubble-body">{p.text}</div>}
      {p.links.length > 0 && (
        <div className="mail-links">
          {p.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="file-att" title={l.url}>
              <Link2 size={15} aria-hidden />
              <span>{l.label}</span>
              <ExternalLink size={13} aria-hidden className="muted" />
            </a>
          ))}
        </div>
      )}
      {p.quoted && (
        <details className="mail-quoted">
          <summary>
            {p.quotedFrom?.endsWith("@viavinilo.com") ? "Ver la respuesta automática de Via Vinilo" : "Ver el mensaje anterior"}
          </summary>
          <div className="bubble-body">{p.quoted}</div>
        </details>
      )}
    </>
  );
}

/** Acciones masivas del bot (D-058): prender o apagar en todos los chats de una vez, con confirmación. */
function BotBulkMenu({ onDone }: { onDone: (s: BotStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "on" | "off" | "notices">(null);
  const [notices, setNotices] = useState<boolean | null>(null);
  const isOwner = getUser()?.roles.includes("OWNER") ?? false;
  useEffect(() => {
    if (open) api<{ enabled: boolean }>("/conversations/notices").then((r) => setNotices(r.enabled)).catch(() => setNotices(null));
  }, [open]);
  async function toggleNotices() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ enabled: boolean }>("/conversations/notices", { method: "PUT", body: JSON.stringify({ enabled: !notices }) });
      setNotices(r.enabled);
      setConfirm(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    setOpen(false);
    setConfirm(null);
    setError("");
  };
  async function run(kind: "on" | "off") {
    setBusy(true);
    setError("");
    try {
      onDone(await api<BotStatus>(`/conversations/bot/${kind}`, { method: "POST" }));
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="menu-wrap">
      <button className="btn btn-ghost btn-sm icon-only" aria-label="Acciones del bot en todos los chats" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <Menu size={16} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          {confirm === "notices" ? (
            <div className="menu-confirm">
              <p>
                {notices
                  ? "Se dejan de mandar los avisos de estado a los clientes."
                  : "A cada cliente le llega un aviso por el chat de la app y por mail cuando su pedido pasa a Archivo recibido, Archivo con error, Cotizado (con la seña si corresponde) y Terminado, listo para retirar. Solo de los cambios que pasen desde ahora."}
              </p>
              <div className="menu-confirm-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancelar
                </button>
                <button className={`btn btn-sm ${notices ? "btn-danger" : "btn-primary"}`} onClick={() => void toggleNotices()} disabled={busy}>
                  {notices ? "Sí, apagar los avisos" : "Sí, prender los avisos"}
                </button>
              </div>
            </div>
          ) : confirm ? (
            <div className="menu-confirm">
              <p>
                {confirm === "on"
                  ? "El bot va a responder en todos los chats de clientes. Los que piden asesor siguen esperando a una persona."
                  : "El bot deja de responder en todos los chats."}
              </p>
              <div className="menu-confirm-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancelar
                </button>
                <button className={`btn btn-sm ${confirm === "on" ? "btn-primary" : "btn-danger"}`} onClick={() => void run(confirm)} disabled={busy}>
                  {confirm === "on" ? "Sí, prender en todos" : "Sí, apagar en todos"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button role="menuitem" className="menu-item" onClick={() => setConfirm("on")}>
                <Bot size={15} aria-hidden /> Prender el bot en todos los chats
              </button>
              <button role="menuitem" className="menu-item" onClick={() => setConfirm("off")}>
                <BotOff size={15} aria-hidden /> Apagar el bot en todos los chats
              </button>
              <div className="menu-section">
                Avisos automáticos a clientes
                <span className={`menu-state${notices ? " on" : ""}`}>{notices === null ? "…" : notices ? "Prendidos" : "Apagados"}</span>
              </div>
              <button
                role="menuitem"
                className="menu-item"
                disabled={!isOwner || notices !== false}
                title={isOwner ? undefined : "Solo el dueño puede prender los avisos: salen mails reales a los clientes"}
                onClick={() => setConfirm("notices")}
              >
                <Bell size={15} aria-hidden /> Prender los avisos automáticos
              </button>
              <button
                role="menuitem"
                className="menu-item"
                disabled={!isOwner || notices !== true}
                title={isOwner ? undefined : "Solo el dueño puede apagar los avisos"}
                onClick={() => setConfirm("notices")}
              >
                <BellOff size={15} aria-hidden /> Apagar los avisos automáticos
              </button>
              {!isOwner && <p className="menu-note">Los avisos los prende o apaga el dueño.</p>}
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function ConversacionesPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showChannels, setShowChannels] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<ConversationRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState("");
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [botBusy, setBotBusy] = useState(false);
  /** Ficha del cliente abierta en el panel (D-058). */
  const [recordOpen, setRecordOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<BotStatus>("/conversations/bot").then(setBot).catch(() => setBot(null));
  }, [thread?.botEnabled, thread?.needsHuman]);

  async function toggleChatBot(enabled: boolean) {
    if (!thread) return;
    setBotBusy(true);
    try {
      await api(`/conversations/${thread.id}/bot`, { method: "POST", body: JSON.stringify({ enabled }) });
      await loadThread(thread.id, false);
      await loadList();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBotBusy(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter, pageSize: "50" });
    if (query) params.set("search", query);
    try {
      const res = await api<{ items: ConversationRow[]; total: number }>(`/conversations?${params}`);
      setList(res.items);
      setTotal(res.total);
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
          <div className="list-title">
            <h1>
              Conversaciones
              {total !== null && <span className="count">{total}</span>}
            </h1>
            <div className="list-tools">
              {bot && bot.chatsWithBot > 0 && (
                <span className="tool-chip" title={`El bot está prendido en ${bot.chatsWithBot} ${bot.chatsWithBot === 1 ? "chat" : "chats"}`}>
                  <Bot size={15} aria-hidden /> {bot.chatsWithBot}
                </span>
              )}
              <button
                className={`tool-btn${CHANNELS.some((c) => c.value === filter) ? " active" : ""}`}
                aria-label="Filtrar por canal"
                aria-expanded={showChannels}
                onClick={() => setShowChannels((v) => !v)}
              >
                <SlidersHorizontal size={17} aria-hidden />
              </button>
              <Help label="Qué es Conversaciones">
                Un hilo por cliente con todo lo que manda: el chat de la app y los mails a las casillas de cada sector
                (con o sin archivo). Si trae un trabajo, el pedido ya está creado y se ve a la derecha. Respondé por la
                app o por mail: el mail sale desde la casilla del sector y en el mismo hilo.
              </Help>
            </div>
          </div>
          <label className="search search-wide">
            <Search size={16} aria-hidden />
            <input
              placeholder="Buscar por nombre, N.º o email"
              aria-label="Buscar conversación"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {showChannels && (
            <div className="channel-filter">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  className="fchip"
                  aria-pressed={filter === c.value}
                  onClick={() => setFilter(filter === c.value ? "ALL" : c.value)}
                >
                  {c.value === "APP" ? <Smartphone size={13} aria-hidden /> : <Mail size={13} aria-hidden />} {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="tabs3" role="tablist">
            {TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={filter === t.value} onClick={() => setFilter(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chats" role="listbox">
          {list?.map((c) => {
            const name = nameOf(c);
            return (
              <button key={c.id} className="chat-row" role="option" aria-selected={c.id === selected} onClick={() => setSelected(c.id)}>
                <span className="avatar-wrap">
                  <span className="avatar avatar-lg">{initials(name)}</span>
                  {c.lastChannel && (
                    <span className={`channel-badge ${c.lastChannel === "APP" ? "app" : "mail"}`} title={c.lastChannel === "APP" ? "Chat de la app" : "Mail"}>
                      {c.lastChannel === "APP" ? <Smartphone size={10} aria-hidden /> : <Mail size={10} aria-hidden />}
                    </span>
                  )}
                </span>
                <span className="row-main">
                  <span className="row-line">
                    <span className="name">{name}</span>
                    <span className="time">{ago(c.lastMessageAt)}</span>
                  </span>
                  <span className="row-line">
                    <span className="last">{c.lastMessagePreview || "—"}</span>
                    <span className="row-icons">
                      {c.needsHuman && (
                        <span className="row-icon human" title="Pide un asesor">
                          <Hand size={12} aria-hidden />
                        </span>
                      )}
                      {c.botEnabled && (
                        <span className="row-icon bot" title="Bot prendido en este chat">
                          <Bot size={12} aria-hidden />
                        </span>
                      )}
                      {c.staffUnread > 0 && <span className="unread">{c.staffUnread}</span>}
                    </span>
                  </span>
                  {(!c.customer || c.customer.status === "PENDING") && (
                    <span className="row-tags">
                      {!c.customer && <span className="mini-tag tag-human">No es cliente</span>}
                      {c.customer?.status === "PENDING" && <span className="mini-tag tag-human">Alta pendiente</span>}
                    </span>
                  )}
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
              {thread.customer ? (
                <button className="thread-who" title="Ver y editar la ficha del cliente" onClick={() => setRecordOpen(true)}>
                  <span className="avatar">{initials(nameOf(thread))}</span>
                  <span className="title">
                    <strong>{nameOf(thread)}</strong>
                    <small>
                      Cliente N.º {thread.customer.customerNumber}
                      {thread.customer.businessName ? ` · ${thread.customer.businessName}` : ""} · Ver ficha
                    </small>
                  </span>
                </button>
              ) : (
                <>
              <span className="avatar">{initials(nameOf(thread))}</span>
              <span className="title">
                <strong>{nameOf(thread)}</strong>
                <small>{`${thread.contactEmail} · todavía no es cliente`}</small>
              </span>
                </>
              )}
              {thread.customer && (
                <button
                  className={`btn btn-sm ${thread.botEnabled ? "btn-soft" : "btn-ghost"}`}
                  disabled={botBusy}
                  title={
                    "El bot responde solo los mensajes del chat de la app de este cliente. Los mails los responde siempre una persona."
                  }
                  onClick={() => void toggleChatBot(!thread.botEnabled)}
                >
                  <Bot size={15} aria-hidden /> {thread.botEnabled ? "Bot prendido en este chat" : "Bot apagado en este chat"}
                </button>
              )}
              <BotBulkMenu
                onDone={(s) => {
                  setBot(s);
                  void loadThread(thread.id, false).then(loadList);
                }}
              />
            </div>
            {thread.needsHuman && (
              <div className="handoff-note">
                <Hand size={16} aria-hidden />
                <span>
                  <b>Pide un asesor.</b> {thread.needsHumanReason ?? "El bot derivó la conversación."} Respondé vos: el bot quedó
                  apagado en este chat.
                </span>
              </div>
            )}
            <div className="messages">
              {thread.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.fromBot ? "ai" : m.fromStaff ? "staff" : m.direction === "IN" ? "in" : "out"}`}>
                  <span className="by">
                    {m.channel === "MAIL" ? <Mail size={12} /> : <Smartphone size={12} />}
                    {m.fromBot && <Bot size={12} aria-hidden />}
                    {m.direction === "OUT"
                      ? m.fromBot
                        ? "Bot"
                        : (m.author?.name ?? "Via Vinilo")
                      : m.fromStaff
                        ? `Reenvío del equipo · ${m.fromEmail}`
                        : m.channel === "MAIL"
                          ? (m.fromEmail ?? "Mail")
                          : "App"}
                    {m.channel === "MAIL" && m.sector && ` · ${m.sector.name}`}
                  </span>
                  {m.subject && <strong className="bubble-subject">{m.subject}</strong>}
                  <MessageBody m={m} />
                  {attachmentsOf(m.attachments).map((a, i) =>
                    a.key ? (
                      <button
                        key={`${m.id}-${i}`}
                        type="button"
                        className="file-att file-att-btn"
                        onClick={() =>
                          void downloadFile(`/conversations/${thread.id}/files/${m.id}/${i}`, a.name).catch((e: unknown) => setError(errorText(e)))
                        }
                      >
                        <Download size={15} aria-hidden /> {a.name}
                        {a.size ? <small className="muted">{formatBytes(a.size)}</small> : null}
                      </button>
                    ) : (
                      <div key={`${m.id}-${i}`} className="file-att" title="El archivo está en el pedido (tablero del sector)">
                        <FileText size={15} aria-hidden /> {a.name}
                      </div>
                    ),
                  )}
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
                <button className="btn btn-ghost" onClick={() => setRecordOpen(true)}>
                  Ver y editar ficha
                </button>
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
            <span className="placeholder-icon">
              <MessagesSquare size={34} aria-hidden />
            </span>
            <strong>Elegí un chat</strong>
            <span className="muted">Abrí una conversación de la lista para leerla y responder.</span>
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

      {recordOpen && thread?.customer && (
        <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && setRecordOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Ficha del cliente">
            <div className="drawer-head">
              <strong>Ficha del cliente</strong>
              <button className="btn btn-ghost btn-sm icon-only" aria-label="Cerrar la ficha" onClick={() => setRecordOpen(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            <CustomerRecord
              key={thread.customer.id}
              id={thread.customer.id}
              embedded
              onChanged={() => void loadThread(thread.id, false).then(loadList)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
