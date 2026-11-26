"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Bot, Hand, Mail, MessagesSquare, Smartphone } from "lucide-react";
import { JOB_STATUS_LABELS, type ConversationThread } from "@viavinilo/contracts";
import { Badge, ars } from "../../ui";
import { BotBulkMenu } from "./bot-bulk-menu";
import { Composer } from "./composer";
import { customerBadge, initials, nameOf, type BotStatus } from "./inbox";
import { MessageBubble } from "./message-bubble";

function ThreadWho({ thread, onOpenRecord }: { thread: ConversationThread; onOpenRecord: () => void }) {
  const name = nameOf(thread);
  if (!thread.customer) {
    return (
      <>
        <span className="avatar">{initials(name)}</span>
        <span className="title">
          <strong>{name}</strong>
          <small>{`${thread.contactEmail} · todavía no es cliente`}</small>
        </span>
      </>
    );
  }
  return (
    <button className="thread-who" title="Ver y editar la ficha del cliente" onClick={onOpenRecord}>
      <span className="avatar">{initials(name)}</span>
      <span className="title">
        <strong>{name}</strong>
        <small>
          Cliente N.º {thread.customer.customerNumber}
          {thread.customer.businessName ? ` · ${thread.customer.businessName}` : ""} · Ver ficha
        </small>
      </span>
    </button>
  );
}

export interface ThreadActions {
  botBusy: boolean;
  onToggleBot: (enabled: boolean) => void;
  onBulkDone: (s: BotStatus) => void;
  onOpenRecord: () => void;
  /** Algo cambió en el hilo: se vuelve a leer con el listado. */
  onChanged: () => void;
  onError: (message: string) => void;
}

export function ThreadPanel({ thread, actions }: { thread: ConversationThread; actions: ThreadActions }) {
  const bottom = useRef<HTMLDivElement>(null);
  // Chrome nuevo devuelve una promesa en scrollIntoView: no se devuelve desde el efecto.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  return (
    <section className="thread">
      <div className="thread-head">
        <ThreadWho thread={thread} onOpenRecord={actions.onOpenRecord} />
        {thread.customer && (
          <button
            className={`btn btn-sm ${thread.botEnabled ? "btn-soft" : "btn-ghost"}`}
            disabled={actions.botBusy}
            title="El bot responde solo los mensajes del chat de la app de este cliente. Los mails los responde siempre una persona."
            onClick={() => actions.onToggleBot(!thread.botEnabled)}
          >
            <Bot size={15} aria-hidden /> {thread.botEnabled ? "Bot prendido en este chat" : "Bot apagado en este chat"}
          </button>
        )}
        <BotBulkMenu onDone={actions.onBulkDone} />
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
          <MessageBubble key={m.id} m={m} threadId={thread.id} onError={actions.onError} />
        ))}
        <div ref={bottom} />
      </div>
      <Composer key={thread.id} thread={thread} onSent={actions.onChanged} />
    </section>
  );
}

function CustomerCard({ customer, onOpenRecord }: { customer: NonNullable<ConversationThread["customer"]>; onOpenRecord: () => void }) {
  const badge = customerBadge(customer.status);
  return (
    <div className="ctx-card">
      <h3>Cliente</h3>
      <dl className="kv">
        <dt>N.º</dt>
        <dd>{customer.customerNumber}</dd>
        <dt>Estado</dt>
        <dd>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </dd>
        <dt>Email</dt>
        <dd>{customer.emails[0]?.email ?? "Falta"}</dd>
        <dt>App</dt>
        <dd>{customer.appPasswordSetAt ? "Activa" : "Sin acceso"}</dd>
      </dl>
      {customer.internalNotes && <p className="muted ctx-notes">{customer.internalNotes}</p>}
      <button className="btn btn-ghost" onClick={onOpenRecord}>
        Ver y editar ficha
      </button>
    </div>
  );
}

/** Columna derecha: quién es y sus pedidos. */
export function ThreadContext({ thread, onOpenRecord }: { thread: ConversationThread; onOpenRecord: () => void }) {
  return (
    <aside className="context">
      {thread.customer ? (
        <CustomerCard customer={thread.customer} onOpenRecord={onOpenRecord} />
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
  );
}

export function NoThread() {
  return (
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
  );
}
