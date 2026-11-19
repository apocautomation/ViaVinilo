"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Send, Sparkles, UserRound } from "lucide-react";
import { AppBar } from "../../../components";
import { ORDERS, STATUS_LABEL, ars } from "../../../data";

/**
 * Asistente de la app (Etapa 2, D-028/D-029): responde solo con datos del sistema y deriva a un asesor.
 * Nunca promete ni modifica nada (actualización §2.7). Conversación de ejemplo.
 */
type Msg = { from: "me" | "bot" | "human"; text: string; time: string; order?: string };

const START: Msg[] = [
  { from: "bot", text: "¡Hola! Soy el asistente de Via Vinilo. Te ayudo con tus pedidos, precios y horarios.", time: "10:40" },
  { from: "me", text: "¿Ya está impreso el VV-000418?", time: "10:41" },
  { from: "bot", text: "Sí. Ya está listo para retirar:", time: "10:41", order: "418" },
];

const SUGGEST = ["¿Dónde está mi pedido?", "¿Cuánto sale el DTF?", "Horarios", "Hablar con un asesor"];

function Chat() {
  const params = useSearchParams();
  const pedido = params.get("pedido");
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    pedido ? [...START, { from: "me", text: `Quiero consultar por el ${pedido}`, time: "10:45" }] : START,
  );
  const [text, setText] = useState("");

  function send(t: string) {
    if (!t.trim()) return;
    const reply: Msg =
      t === "Hablar con un asesor"
        ? { from: "bot", text: "Listo, te paso con un asesor. Te responde por acá mismo.", time: "10:46" }
        : { from: "bot", text: "Esto es una vista previa: el asistente se conecta en la Etapa 2.", time: "10:46" };
    setMsgs((m) => [...m, { from: "me", text: t, time: "10:46" }, reply]);
    setText("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  return (
    <>
      <div className="chat">
        {msgs.map((m, i) => {
          const order = m.order ? ORDERS.find((o) => o.id === m.order) : undefined;
          return (
            <div key={i} className={`bubble ${m.from === "me" ? "me" : "bot"}`}>
              {m.from !== "me" && (
                <span className="bot-name">
                  {m.from === "bot" ? <Sparkles size={12} /> : <UserRound size={12} />}
                  {m.from === "bot" ? "Asistente" : "Asesor"}
                </span>
              )}
              {m.text}
              {order && (
                <span className="chat-card">
                  <strong>{order.num}</strong>
                  <span>
                    {STATUS_LABEL[order.status]} · {order.amount ? ars.format(order.amount) : "sin cotizar"}
                  </span>
                </span>
              )}
              <time>{m.time}</time>
            </div>
          );
        })}
      </div>
      <form className="composer" onSubmit={submit}>
        <div className="suggest">
          {SUGGEST.map((s) => (
            <button type="button" key={s} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="composer-row">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu consulta…" aria-label="Mensaje" />
          <button className="send" aria-label="Enviar">
            <Send size={19} />
          </button>
        </div>
      </form>
    </>
  );
}

export default function AsistentePage() {
  return (
    <>
      <AppBar title="Asistente" back right={<span className="preview-chip">Etapa 2</span>} />
      <Suspense>
        <Chat />
      </Suspense>
    </>
  );
}
