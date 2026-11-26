"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CustomerRecord } from "../clientes/customer-record";
import { ConversationList } from "./conversation-list";
import { NoThread, ThreadContext, ThreadPanel } from "./thread-view";
import { useInbox } from "./use-inbox";

/**
 * Bandeja de Conversaciones (D-041, D-045): un hilo por cliente con el chat de la app y los mails
 * de las casillas de los sectores. El asesor responde por la app o por mail, desde la casilla del
 * sector y en el mismo hilo del mail del cliente.
 */
export default function ConversacionesPage() {
  const inbox = useInbox();
  const { thread, refresh } = inbox;
  /** Ficha del cliente abierta en el panel (D-058). */
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <div className="inbox">
      <ConversationList
        list={inbox.list}
        total={inbox.total}
        bot={inbox.bot}
        filter={inbox.filter}
        onFilter={inbox.setFilter}
        search={inbox.search}
        onSearch={inbox.setSearch}
        query={inbox.query}
        selected={inbox.selected}
        onSelect={inbox.setSelected}
        error={inbox.error}
      />

      {thread ? (
        <>
          <ThreadPanel
            thread={thread}
            actions={{
              botBusy: inbox.botBusy,
              onToggleBot: (enabled) => void inbox.toggleChatBot(enabled),
              onBulkDone: (s) => {
                inbox.setBot(s);
                refresh();
              },
              onOpenRecord: () => setRecordOpen(true),
              onChanged: refresh,
              onError: inbox.setError,
            }}
          />
          <ThreadContext thread={thread} onOpenRecord={() => setRecordOpen(true)} />
        </>
      ) : (
        <NoThread />
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
            <CustomerRecord key={thread.customer.id} id={thread.customer.id} embedded onChanged={refresh} />
          </aside>
        </div>
      )}
    </div>
  );
}
