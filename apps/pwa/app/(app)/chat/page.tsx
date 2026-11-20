"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CircleHelp, Mail, Send } from "lucide-react";
import { AppBar } from "../../components";
import { api } from "../../session";

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
  attachments: string[] | null;
  createdAt: string;
}
/** Cada cuánto se buscan respuestas nuevas (hasta tener las notificaciones push del paso 6). */
const REFRESH_MS = 8000;

function Chat() {
  const pedido = useSearchParams().get("pedido");
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState(pedido ? `Consulta por el pedido ${pedido}: ` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
            <span className="bubble-text">{m.body}</span>
            {m.attachments && m.attachments.length > 0 && <span className="via-mail">{m.attachments.join(", ")}</span>}
            <time dateTime={m.createdAt}>
              {new Date(m.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        <div className="composer-row">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu mensaje…" aria-label="Mensaje" />
          <button className="send" aria-label="Enviar" disabled={busy || !text.trim()}>
            <Send size={19} />
          </button>
        </div>
      </form>
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
