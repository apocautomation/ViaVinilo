"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleHelp, Download, Mail, Paperclip, Send, X } from "lucide-react";
import { ACCEPT_ATTRIBUTE, attachmentsOf, defaultPickupBranch, formatBytes, help, MAX_UPLOAD_BYTES, PICKUP_BRANCHES, PICKUP_LABELS, type PickupBranch, type SectorCode } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { api, downloadFile, upload } from "../../session";

/** Texto del mensaje con los links tocables (D-066): el bot manda mapas y la tienda. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part.replace(/[.,;)]+$/, "")} target="_blank" rel="noreferrer">
            {part.replace(/^https?:\/\/(www\.)?/, "").replace(/[.,;)]+$/, "")}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Servicio de la Ayuda → tablero donde entra el pedido (D-062). */
const SECTOR_OF: Record<string, SectorCode> = {
  "dtf-textil": "DTF",
  "dtf-uv": "DTF_UV",
  sublimacion: "SUBLIMACION",
  calandra: "CALANDRADO",
  // D-082: cada sub-servicio de Gran Formato entra con su nombre (se ven juntos en ese tablero).
  "uv-rigidos": "UV_RIGIDOS",
  ecosolvente: "ECOSOLVENTE",
  "uv-rollo": "UV_ROLLO",
  corte: "CORTES",
  latex: "LATEX",
};

/**
 * Mandar un archivo por el chat (D-062): el cliente elige el servicio, escribe medidas y cantidad, y
 * el pedido se crea solo en el tablero de ese servicio, en "Archivo recibido".
 */
function SendFile({ onClose, onSent }: { onClose: () => void; onSent: (label: string) => void }) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /** D-083: dónde lo retira. Se propone la sucursal del servicio y el cliente la puede cambiar. */
  const [pickup, setPickup] = useState<PickupBranch | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const service = help.SERVICES.find((s) => s.id === serviceId);
  /** Tableros creados desde el ERP que no son un servicio de base (D-064). */
  const [extra, setExtra] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    const base = new Set<string>(Object.values(SECTOR_OF));
    api<{ code: string; name: string }[]>("/app/sectors")
      .then((all) => setExtra(all.filter((x) => !base.has(x.code))))
      .catch(() => undefined);
  }, []);
  const extraBoard = extra.find((x) => `sector:${x.code}` === serviceId);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!file || !serviceId) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("El archivo es muy grande: el máximo es 150 MB.");
    const form = new FormData();
    const sectorCode = extraBoard ? extraBoard.code : SECTOR_OF[serviceId]!;
    form.append("sector", sectorCode);
    form.append("pickupBranch", pickup ?? defaultPickupBranch(sectorCode));
    const label = service?.name ?? extraBoard?.name;
    const details = [label ? `Servicio: ${label}` : "", note.trim()].filter(Boolean).join("\n");
    if (details) form.append("note", details);
    form.append("file", file);
    setError("");
    setProgress(0);
    try {
      const r = await upload<{ job: { label: string } }>("/app/chat/files", form, setProgress);
      onSent(r.job.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
      setProgress(null);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && progress === null && onClose()}>
      <form className="sheet" onSubmit={send} aria-label="Mandar un archivo">
        <div className="sheet-head">
          <strong>Mandar un archivo</strong>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose} disabled={progress !== null}>
            <X size={20} />
          </button>
        </div>
        <p className="sheet-label">1 · ¿Para qué servicio?</p>
        <div className="choices">
          {help.SERVICES.map((s) => (
            <button type="button" key={s.id} className="choice" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
              {s.name}
            </button>
          ))}
          {extra.map((x) => (
            <button type="button" key={x.code} className="choice" aria-pressed={serviceId === `sector:${x.code}`} onClick={() => setServiceId(`sector:${x.code}`)}>
              {x.name}
            </button>
          ))}
        </div>
        {service && <p className="muted sheet-hint">Formato: {service.formats}.</p>}
        <p className="sheet-label">2 · Medidas y cantidad</p>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: 58 × 100 cm, 2 copias" />
        <p className="sheet-label">3 · ¿Dónde lo retirás?</p>
        <div className="choices">
          {PICKUP_BRANCHES.map((b) => {
            const selected = (pickup ?? (serviceId ? defaultPickupBranch(extraBoard ? extraBoard.code : SECTOR_OF[serviceId]!) : null)) === b;
            return (
              <button type="button" key={b} className="choice" aria-pressed={selected} onClick={() => setPickup(b)}>
                {help.BRANCHES.find((x) => x.id === b)?.name ?? PICKUP_LABELS[b]}
                <small className="muted" style={{ display: "block", fontWeight: 400 }}>{help.BRANCHES.find((x) => x.id === b)?.address}</small>
              </button>
            );
          })}
        </div>
        <p className="sheet-label">4 · El archivo</p>
        <label className="drop">
          <Paperclip size={24} />
          <strong>{file ? file.name : "Tocá para elegir el archivo"}</strong>
          <span>{file ? formatBytes(file.size) : "PDF, PNG, JPG, TIF, AI, EPS, PSD, CDR o ZIP · hasta 150 MB"}</span>
          <input type="file" hidden accept={ACCEPT_ATTRIBUTE} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        {progress !== null && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={!file || !serviceId || progress !== null}>
          {progress !== null ? `Subiendo… ${Math.round(progress * 100)}%` : "Mandar el archivo"}
        </button>
      </form>
    </div>
  );
}

/**
 * Chat de la app (D-045): el cliente le escribe a Via Vinilo y le responde un asesor. Acá también
 * se ven sus mails a las casillas y las respuestas por mail, todo en un solo hilo.
 */
interface Msg {
  id: string;
  direction: "IN" | "OUT";
  fromBot?: boolean;
  channel: "APP" | "MAIL";
  subject: string | null;
  body: string;
  attachments: unknown;
  createdAt: string;
  jobId?: string | null;
}
/** Cada cuánto se buscan respuestas nuevas (hasta tener las notificaciones push del paso 6). */
const REFRESH_MS = 8000;

function Chat() {
  const pedido = useSearchParams().get("pedido");
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState(pedido ? `Consulta por el pedido ${pedido}: ` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setMsgs((await api<{ messages: Msg[] }>("/app/chat")).messages);
    } catch {
      /* sin conexión: se reintenta en la próxima vuelta */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  // Chrome nuevo devuelve una promesa en scrollIntoView: no se devuelve desde el efecto.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs?.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api("/app/chat", { method: "POST", body: JSON.stringify({ text }) });
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos mandar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="chat">
        {msgs && msgs.length === 0 && (
          <div className="chat-empty">
            <strong>Escribinos por acá</strong>
            <span>Consultas, pedidos o lo que necesites. Te responde un asesor de Via Vinilo y te avisamos en este chat.</span>
          </div>
        )}
        {msgs?.map((m) => (
          <div key={m.id} className={`bubble ${m.direction === "IN" ? "me" : "bot"}`}>
            {m.direction === "OUT" && <span className="bot-name">{m.fromBot ? "Asistente virtual de Via Vinilo" : "Via Vinilo"}</span>}
            {m.channel === "MAIL" && (
              <span className="via-mail">
                <Mail size={12} aria-hidden /> {m.direction === "IN" ? "Tu mail" : "Por mail"}
                {m.subject ? ` · ${m.subject}` : ""}
              </span>
            )}
            <span className="bubble-text">
              <Linkified text={m.body} />
            </span>
            {attachmentsOf(m.attachments).map((a, i) =>
              a.key ? (
                <button
                  key={`${m.id}-${i}`}
                  type="button"
                  className="file-chip"
                  onClick={() => void downloadFile(`/app/chat/files/${m.id}/${i}`, a.name).catch((e: unknown) => setError(e instanceof Error ? e.message : "No pudimos descargar el archivo."))}
                >
                  <Download size={14} aria-hidden /> {a.name}
                  {a.size ? <small>{formatBytes(a.size)}</small> : null}
                </button>
              ) : (
                <span key={`${m.id}-${i}`} className="via-mail">
                  {a.name}
                </span>
              ),
            )}
            {m.jobId && m.direction === "IN" && m.channel === "APP" && <span className="via-mail">Pedido creado: lo ves en Pedidos</span>}
            <time dateTime={m.createdAt}>
              {new Date(m.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}
        <div className="composer-row">
          <button type="button" className="attach" aria-label="Mandar un archivo" onClick={() => setSending(true)}>
            <Paperclip size={20} />
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu mensaje…" aria-label="Mensaje" />
          <button className="send" aria-label="Enviar" disabled={busy || !text.trim()}>
            <Send size={19} />
          </button>
        </div>
      </form>
      {sending && (
        <SendFile
          onClose={() => setSending(false)}
          onSent={(label) => {
            setSending(false);
            setNotice(`¡Listo! Recibimos tu archivo: pedido ${label}. Lo revisamos y te pasamos el precio.`);
            void load();
          }}
        />
      )}
    </>
  );
}

export default function ChatPage() {
  return (
    <>
      <AppBar
        title="Chat"
        right={
          <Link href="/ayuda" className="icon-btn" aria-label="Ayuda">
            <CircleHelp size={22} />
          </Link>
        }
      />
      <Suspense>
        <Chat />
      </Suspense>
    </>
  );
}
