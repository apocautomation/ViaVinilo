"use client";

import { useState } from "react";
import { Mail, MessagesSquare, Search, Smartphone } from "lucide-react";
import { Help } from "../../help";

/**
 * Bandeja de Conversaciones (D-041, D-045). Junta en un hilo por cliente lo que llega por los
 * tres canales: el chat de la app, los envíos desde "+" de la app y los mails de las casillas
 * de cada sector. Por ahora está vacía: sin datos de ejemplo (D-045).
 * TODO(spec): I-18 — modelo de conversaciones y mensajes, lectura de mails (D-043) y respuestas.
 */
const FILTERS = ["Todas", "Sin leer", "App", "Mail"] as const;

export default function ConversacionesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todas");

  return (
    <div className="inbox inbox-empty">
      <aside className="inbox-list" aria-label="Conversaciones">
        <div className="inbox-list-head">
          <h1>
            <span style={{ display: "flex", alignItems: "center" }}>
              Conversaciones
              <Help label="Qué es Conversaciones">
                Un hilo por cliente con todo lo que manda: mensajes del chat de la app, trabajos enviados desde la app y
                mails a las casillas de cada sector. Si un mail o un mensaje trae un trabajo, se crea el pedido; si no, el
                asesor responde o arma el pedido desde acá.
              </Help>
            </span>
          </h1>
          <label className="search" style={{ width: "100%" }}>
            <Search size={15} aria-hidden />
            <input placeholder="Buscar cliente o pedido…" aria-label="Buscar conversación" disabled />
          </label>
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f} className="fchip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="empty" style={{ padding: 32 }}>
          Todavía no hay conversaciones.
        </div>
      </aside>

      <section className="thread">
        <div className="empty inbox-placeholder">
          <MessagesSquare size={36} aria-hidden />
          <strong>Acá van a aparecer las conversaciones de los clientes</strong>
          <span className="channels">
            <span>
              <Smartphone size={15} aria-hidden /> Chat y envíos desde la app
            </span>
            <span>
              <Mail size={15} aria-hidden /> Mails a las casillas de cada sector
            </span>
          </span>
        </div>
      </section>
    </div>
  );
}
