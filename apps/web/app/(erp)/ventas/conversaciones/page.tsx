"use client";

import { useState } from "react";
import {
  Bot,
  CheckCheck,
  ClipboardPlus,
  FileText,
  Paperclip,
  Search,
  Send,
  Smartphone,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Badge, ars } from "../../ui";

/**
 * Bandeja de conversaciones de la app de clientes (D-032). Mismo esquema que la de Krokanticas
 * (lista + chat + bot/humano), pero el canal es la app propia de Via Vinilo, no WhatsApp:
 * sin ventana de 24 h ni costo por mensaje. Datos de ejemplo.
 * TODO(spec): I-18 — endpoints de mensajería de la app (equivalentes a /api/chats, /api/messages,
 * /api/send-message y /api/toggle-bot de Krokanticas) se definen en la Etapa 2.
 */
type Mode = "ai" | "human";
type Msg =
  | { kind: "in" | "out" | "ai"; text: string; time: string; file?: string; by?: string }
  | { kind: "event"; text: string }
  | { kind: "day"; text: string };

interface Chat {
  id: string;
  name: string;
  number: number;
  mode: Mode;
  unread: number;
  last: string;
  when: string;
  tags: string[];
  messages: Msg[];
  handoff?: string;
  orders: { num: string; desc: string; status: string; tone: "ok" | "warn" | "info"; amount?: number }[];
  balance: number;
}

const CHATS: Chat[] = [
  {
    id: "1",
    name: "Remeras del Norte",
    number: 128,
    mode: "ai",
    unread: 2,
    last: "¿Ya está impreso el VV-000418?",
    when: "10:42",
    tags: ["DTF", "Mayorista"],
    balance: 0,
    orders: [
      { num: "VV-000418", desc: "DTF 58 cm × 3 m · frente escuela", status: "Impreso", tone: "info", amount: 54000 },
      { num: "VV-000421", desc: "DTF 58 cm × 1,2 m · logos", status: "Cotizado", tone: "warn", amount: 21600 },
    ],
    messages: [
      { kind: "day", text: "Hoy" },
      { kind: "in", text: "Hola! Te subí el archivo de las remeras de la escuela 🙌", time: "09:15", file: "frente-escuela.pdf · 4,2 MB" },
      { kind: "event", text: "Pedido VV-000418 creado · Archivo recibido · DTF" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "¡Gracias! Recibimos el archivo y está en revisión. Te aviso por acá apenas esté cotizado.", time: "09:15" },
      { kind: "event", text: "VV-000418 · Cotizado · $ 54.000,00 · listo hoy 13:00" },
      { kind: "event", text: "VV-000418 · Impreso" },
      { kind: "in", text: "¿Ya está impreso el VV-000418?", time: "10:41" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "Sí 😊 El VV-000418 ya está impreso y pasa a terminado en unos minutos. Lo podés retirar por el local desde las 13:00.", time: "10:42" },
      { kind: "in", text: "Genial. Y el otro, ¿cuánto quedó?", time: "10:42" },
    ],
  },
  {
    id: "2",
    name: "Estampados Güemes",
    number: 87,
    mode: "human",
    unread: 1,
    last: "Te mando el archivo corregido",
    when: "10:35",
    tags: ["Sublimación"],
    balance: 35200,
    handoff: "El cliente pide un descuento por cantidad: la IA no puede prometer precios.",
    orders: [{ num: "VV-000415", desc: "Tela sublimada 3 m", status: "Archivo con error", tone: "warn" }],
    messages: [
      { kind: "day", text: "Hoy" },
      { kind: "event", text: "VV-000415 · Archivo con error · Resolución menor a 150 dpi" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "Hola! El archivo del VV-000415 tiene una resolución baja (menos de 150 dpi). ¿Lo podés reenviar en mejor calidad?", time: "09:58" },
      { kind: "in", text: "Si hago 20 metros, ¿me hacen precio?", time: "10:20" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "Te paso con un asesor para que lo vea con vos 👍", time: "10:20" },
      { kind: "out", by: "Verónica", text: "Hola! Sí, para 20 m te hacemos un 10%. Mandame el archivo corregido y lo cotizo.", time: "10:30" },
      { kind: "in", text: "Te mando el archivo corregido", time: "10:35", file: "tela-v2.tif · 38 MB" },
    ],
  },
  {
    id: "3",
    name: "Gráfica Lerma",
    number: 54,
    mode: "ai",
    unread: 0,
    last: "¿Cuánto sale 3 m de vinilo mate?",
    when: "10:21",
    tags: ["Gran Formato"],
    balance: 0,
    orders: [{ num: "VV-000402", desc: "Lona 2 × 1 m", status: "Cotizado", tone: "warn", amount: 18900 }],
    messages: [
      { kind: "day", text: "Hoy" },
      { kind: "in", text: "¿Cuánto sale 3 m de vinilo mate?", time: "10:20" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "El vinilo mate impreso sale $ 9.800 el metro lineal (ancho 1,52 m). Para 3 m serían $ 29.400. ¿Querés que lo cargue como pedido?", time: "10:21" },
    ],
  },
  {
    id: "4",
    name: "Sublimarte",
    number: 211,
    mode: "ai",
    unread: 0,
    last: "Paso a buscar a las 18",
    when: "09:58",
    tags: ["Sublimación", "Cuenta corriente"],
    balance: 120000,
    orders: [{ num: "VV-000411", desc: "Sublimación 40 tazas", status: "Listo para retirar", tone: "ok", amount: 120000 }],
    messages: [
      { kind: "day", text: "Hoy" },
      { kind: "event", text: "VV-000411 · Listo para retirar · aviso enviado por la app" },
      { kind: "in", text: "Paso a buscar a las 18", time: "09:58" },
      { kind: "ai", by: "Asistente Via Vinilo", text: "¡Perfecto! Te esperamos. Ya está todo embalado.", time: "09:58" },
    ],
  },
  {
    id: "5",
    name: "Diseños Cafayate",
    number: 302,
    mode: "ai",
    unread: 0,
    last: "Gracias!!",
    when: "Ayer",
    tags: ["DTF UV"],
    balance: 0,
    orders: [],
    messages: [
      { kind: "day", text: "Ayer" },
      { kind: "event", text: "VV-000396 · Entregado" },
      { kind: "in", text: "Gracias!!", time: "18:12" },
    ],
  },
];

const FILTERS = ["Todas", "Sin leer", "Asistente IA", "Asesor"] as const;
const QUICK = ["Ya está listo para retirar", "¿Me reenviás el archivo?", "Te paso la cotización", "Te paso los horarios del local"];

export default function ConversacionesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todas");
  const [selected, setSelected] = useState("1");
  const [modes, setModes] = useState<Record<string, Mode>>(() => Object.fromEntries(CHATS.map((c) => [c.id, c.mode])));

  const list = CHATS.filter((c) => {
    if (filter === "Sin leer") return c.unread > 0;
    if (filter === "Asistente IA") return modes[c.id] === "ai";
    if (filter === "Asesor") return modes[c.id] === "human";
    return true;
  });
  const chat = CHATS.find((c) => c.id === selected) ?? CHATS[0]!;
  const mode = modes[chat.id];

  return (
    <div className="inbox">
      <aside className="inbox-list" aria-label="Conversaciones">
        <div className="inbox-list-head">
          <h1>
            Conversaciones
            <span className="preview-pill">Vista previa · E2</span>
          </h1>
          <label className="search" style={{ width: "100%" }}>
            <Search size={15} aria-hidden />
            <input placeholder="Buscar cliente o pedido…" aria-label="Buscar conversación" />
          </label>
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f} className="fchip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="chats" role="listbox">
          {list.map((c) => (
            <button key={c.id} className="chat-row" role="option" aria-selected={c.id === chat.id} onClick={() => setSelected(c.id)}>
              <span className="avatar">{c.name.split(" ").filter((p) => p.length > 3).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("")}</span>
              <span style={{ minWidth: 0, display: "grid", gap: 3 }}>
                <span className="name">{c.name}</span>
                <span className="last">{c.last}</span>
                <span style={{ display: "flex", gap: 4 }}>
                  <span className={`mini-tag ${modes[c.id] === "ai" ? "tag-ai" : "tag-human"}`}>
                    {modes[c.id] === "ai" ? "IA" : "Asesor"}
                  </span>
                  {c.tags.slice(0, 2).map((t) => (
                    <span key={t} className="mini-tag" style={{ background: "var(--color-neutral-100)", color: "var(--color-text-muted)" }}>
                      {t}
                    </span>
                  ))}
                </span>
              </span>
              <span className="meta">
                {c.when}
                {c.unread > 0 && <span className="unread">{c.unread}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="thread" aria-label={`Chat con ${chat.name}`}>
        <header className="thread-head">
          <span className="avatar">{chat.name.split(" ").filter((p) => p.length > 3).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("")}</span>
          <span className="title">
            <strong>{chat.name}</strong>
            <small style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Smartphone size={12} aria-hidden /> App Via Vinilo · Cliente N.º {chat.number}
              {mode === "ai" ? " · responde el asistente" : " · lo atiende un asesor"}
            </small>
          </span>
          <div className="seg" role="group" aria-label="Quién responde">
            <button aria-pressed={mode === "ai"} onClick={() => setModes({ ...modes, [chat.id]: "ai" })}>
              <Bot size={13} style={{ verticalAlign: -2 }} /> Asistente IA
            </button>
            <button aria-pressed={mode === "human"} onClick={() => setModes({ ...modes, [chat.id]: "human" })}>
              <UserRound size={13} style={{ verticalAlign: -2 }} /> Asesor
            </button>
          </div>
        </header>

        <div className="messages">
          {chat.messages.map((m, i) => {
            if (m.kind === "day") return <span key={i} className="day">{m.text}</span>;
            if (m.kind === "event")
              return (
                <span key={i} className="sys-event">
                  <ClipboardPlus size={13} aria-hidden /> {m.text}
                </span>
              );
            return (
              <div key={i} className={`bubble ${m.kind}`}>
                {m.by && (
                  <span className="by">
                    {m.kind === "ai" ? <Sparkles size={12} /> : <UserRound size={12} />} {m.by}
                  </span>
                )}
                {m.text}
                {m.file && (
                  <span className="file-att">
                    <FileText size={16} aria-hidden /> {m.file}
                  </span>
                )}
                <time>
                  {m.time} {m.kind !== "in" && <CheckCheck size={12} style={{ verticalAlign: -2 }} />}
                </time>
              </div>
            );
          })}
        </div>

        <div className="composer">
          {chat.handoff && mode === "ai" && (
            <div className="handoff">
              <Bot size={16} aria-hidden /> <span><strong>La IA derivó la conversación:</strong> {chat.handoff}</span>
              <button className="btn btn-primary" onClick={() => setModes({ ...modes, [chat.id]: "human" })}>
                Tomar conversación
              </button>
            </div>
          )}
          <div className="quick">
            <Zap size={14} style={{ color: "var(--color-text-muted)", alignSelf: "center" }} aria-hidden />
            {QUICK.map((q) => (
              <button key={q}>{q}</button>
            ))}
          </div>
          <div className="composer-row">
            <button className="icon-btn" aria-label="Adjuntar archivo">
              <Paperclip size={18} />
            </button>
            <input
              placeholder={mode === "ai" ? "El asistente está respondiendo. Escribí para tomar la conversación…" : "Escribí un mensaje…"}
              aria-label="Mensaje"
            />
            <button className="btn btn-primary">
              <Send size={15} /> Enviar
            </button>
          </div>
        </div>
      </section>

      <aside className="context" aria-label="Datos del cliente">
        <div className="ctx-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="avatar">{chat.name.split(" ").filter((p) => p.length > 3).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("")}</span>
            <div>
              <strong>{chat.name}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Cliente N.º {chat.number} · alta validada</div>
            </div>
          </div>
          <dl className="kv">
            <dt>Saldo en cuenta</dt>
            <dd style={{ color: chat.balance > 0 ? "var(--color-danger)" : undefined }}>{ars.format(chat.balance)}</dd>
            <dt>Pedidos este mes</dt>
            <dd>12</dd>
            <dt>Requiere seña</dt>
            <dd>No</dd>
          </dl>
        </div>

        <div className="ctx-card">
          <h3>Pedidos activos</h3>
          {chat.orders.length === 0 && <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Sin pedidos en curso</span>}
          {chat.orders.map((o) => (
            <div key={o.num} className="order-mini">
              <header>
                <span className="mono">{o.num}</span>
                <Badge tone={o.tone}>{o.status}</Badge>
              </header>
              <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{o.desc}</span>
              {o.amount && <strong style={{ fontSize: 13 }}>{ars.format(o.amount)}</strong>}
            </div>
          ))}
        </div>

        <div className="ctx-card">
          <h3>Acciones</h3>
          <button className="btn btn-primary">
            <ClipboardPlus size={15} /> Crear pedido desde el chat
          </button>
          <button className="btn btn-ghost">Enviar cotización</button>
          <button className="btn btn-ghost">Ver ficha del cliente</button>
        </div>
      </aside>
    </div>
  );
}
