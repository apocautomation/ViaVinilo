"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleHelp, Download, Mail, Paperclip, Send, X } from "lucide-react";
import { attachmentsOf, defaultPickupBranch, formatBytes, help, type AppOrder, type PickupBranch } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { progressPercent, sectorCodeFor } from "../../upload";
import { BranchChoices, FileDrop, ServiceChoices, UploadProgress, useExtraBoards, useUpload } from "../../upload-parts";
import { VariantPicker, type Variant } from "../../variant-picker";
import { api, downloadFile } from "../../session";

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


/**
 * Mandar un archivo por el chat (D-062): el cliente elige el servicio, escribe medidas y cantidad, y
 * el pedido se crea solo en el tablero de ese servicio, en "Archivo recibido".
 */
function SendFile({ onClose, onSent, initialJob }: { onClose: () => void; onSent: (label: string, added: boolean) => void; initialJob?: string | null }) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  /** D-094: el archivo puede ser para un pedido que ya existe (corregido o que faltaba). */
  const [jobId, setJobId] = useState<string | null>(initialJob ?? null);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  useEffect(() => {
    api<{ orders: AppOrder[] }>("/app/jobs")
      .then((r) => setOrders(r.orders.filter((o) => o.canAddFile)))
      .catch(() => undefined);
  }, []);
  const targetOrder = orders.find((o) => o.id === jobId);
  const [note, setNote] = useState("");
  /** D-083: dónde lo retira. Se propone la sucursal del servicio y el cliente la puede cambiar. */
  const [pickup, setPickup] = useState<PickupBranch | null>(null);
  /** D-095: material u opción de impresión del servicio elegido. */
  const [variant, setVariant] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const { progress, error, send: sendFile } = useUpload<{ job: { label: string }; resent?: boolean; added?: boolean }>();
  const service = help.SERVICES.find((s) => s.id === serviceId);
  const extra = useExtraBoards();
  const sectorCode = sectorCodeFor(serviceId, extra);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!file || (!sectorCode && !jobId)) return;
    const form = new FormData();
    if (jobId) form.append("job", jobId);
    else if (sectorCode) {
      form.append("sector", sectorCode);
      form.append("pickupBranch", pickup ?? defaultPickupBranch(sectorCode));
      if (variant) form.append("variant", variant);
    }
    // D-091: el servicio ya va en el tablero del pedido; repetirlo en la nota ensuciaba la descripción.
    if (note.trim()) form.append("note", note.trim());
    form.append("file", file);
    const r = await sendFile(file, form);
    if (r) onSent(r.job.label, Boolean(r.resent || r.added));
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
        {orders.length > 0 && (
          <>
            <p className="sheet-label">¿Es un trabajo nuevo o para un pedido que ya tenés?</p>
            <div className="choices">
              <button type="button" className="choice" aria-pressed={jobId === null} onClick={() => setJobId(null)}>
                Trabajo nuevo
              </button>
              {orders.map((o) => (
                <button type="button" key={o.id} className="choice" aria-pressed={jobId === o.id} onClick={() => setJobId(o.id)}>
                  {o.num}
                  <small className="muted" style={{ display: "block", fontWeight: 400 }}>
                    {o.sector}
                    {o.status === "FILE_ERROR" ? " · archivo con error" : ""}
                  </small>
                </button>
              ))}
            </div>
          </>
        )}
        {jobId !== null && (
          <>
            <p className="muted sheet-hint">
              El archivo se suma al pedido {targetOrder?.num ?? ""}
              {targetOrder?.status === "FILE_ERROR" ? " y vuelve a revisión." : "."}
            </p>
            <p className="sheet-label">Aclaración (opcional)</p>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: es el archivo corregido en 300 dpi" />
          </>
        )}
        {jobId === null && (
          <>
        <p className="sheet-label">1 · ¿Para qué servicio?</p>
        <ServiceChoices value={serviceId} onChange={setServiceId} extra={extra} />
        {service && <p className="muted sheet-hint">Formato: {service.formats}.</p>}
        <VariantPicker
          sectorCode={sectorCode}
          value={variant}
          onChange={setVariant}
          onList={setVariants}
          title="¿Qué opción de impresión?"
        />
        <p className="sheet-label">2 · Medidas y cantidad</p>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: 58 × 100 cm, 2 copias" />
        <p className="sheet-label">3 · ¿Dónde lo retirás?</p>
        <BranchChoices selected={pickup ?? (sectorCode ? defaultPickupBranch(sectorCode) : null)} onPick={setPickup} />
          </>
        )}
        <p className="sheet-label">{jobId === null ? "4 · El archivo" : "El archivo"}</p>
        <FileDrop file={file} prompt="Tocá para elegir el archivo" onChange={setFile} />
        {error && <p className="form-error">{error}</p>}
        <UploadProgress progress={progress} />
        <button className="btn btn-primary btn-block" disabled={!file || (!serviceId && jobId === null) || (jobId === null && variants.length > 0 && !variant) || progress !== null}>
          {progress !== null ? `Subiendo… ${progressPercent(progress)}%` : "Mandar el archivo"}
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
  const params = useSearchParams();
  const pedido = params.get("pedido");
  /** D-094: desde el pedido con error se llega con el clip ya abierto y ese pedido elegido. */
  const fileFor = params.get("archivo");
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState(pedido && !fileFor ? `Consulta por el pedido ${pedido}: ` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(Boolean(fileFor));
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
            {m.jobId && m.direction === "IN" && m.channel === "APP" && <span className="via-mail">Quedó en tu pedido: lo ves en Pedidos</span>}
            <time dateTime={m.createdAt}>
              {new Date(m.createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Salta", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
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
          initialJob={fileFor}
          onSent={(label, added) => {
            setSending(false);
            setNotice(added ? `¡Listo! Sumamos el archivo al pedido ${label}. Lo revisamos y te avisamos.` : `¡Listo! Recibimos tu archivo: pedido ${label}. Lo revisamos y te pasamos el precio.`);
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
