"use client";

import { useState } from "react";
import { Bot, Hand, Mail, Search, SlidersHorizontal, Smartphone } from "lucide-react";
import type { ConversationRow } from "@viavinilo/contracts";
import { Help } from "../../help";
import { ago, CHANNELS, emptyListText, initials, isChannelFilter, nameOf, TABS, type BotStatus, type Filter } from "./inbox";

function ChannelBadge({ channel }: { channel: ConversationRow["lastChannel"] }) {
  if (!channel) return null;
  const app = channel === "APP";
  return (
    <span className={`channel-badge ${app ? "app" : "mail"}`} title={app ? "Chat de la app" : "Mail"}>
      {app ? <Smartphone size={10} aria-hidden /> : <Mail size={10} aria-hidden />}
    </span>
  );
}

function ChatRow({ c, selected, onSelect }: { c: ConversationRow; selected: boolean; onSelect: () => void }) {
  const name = nameOf(c);
  return (
    <button className="chat-row" role="option" aria-selected={selected} onClick={onSelect}>
      <span className="avatar-wrap">
        <span className="avatar avatar-lg">{initials(name)}</span>
        <ChannelBadge channel={c.lastChannel} />
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
        {!c.customer && (
          <span className="row-tags">
            <span className="mini-tag tag-human">No es cliente</span>
          </span>
        )}
        {c.customer?.status === "PENDING" && (
          <span className="row-tags">
            <span className="mini-tag tag-human">Alta pendiente</span>
          </span>
        )}
      </span>
    </button>
  );
}

function ListHead(props: { total: number | null; bot: BotStatus | null; filter: Filter; onFilter: (f: Filter) => void; search: string; onSearch: (s: string) => void }) {
  const { filter, onFilter, bot } = props;
  const [showChannels, setShowChannels] = useState(false);
  return (
    <div className="inbox-list-head">
      <div className="list-title">
        <h1>
          Conversaciones
          {props.total !== null && <span className="count">{props.total}</span>}
        </h1>
        <div className="list-tools">
          {bot && bot.chatsWithBot > 0 && (
            <span className="tool-chip" title={`El bot está prendido en ${bot.chatsWithBot} ${bot.chatsWithBot === 1 ? "chat" : "chats"}`}>
              <Bot size={15} aria-hidden /> {bot.chatsWithBot}
            </span>
          )}
          <button className={`tool-btn${isChannelFilter(filter) ? " active" : ""}`} aria-label="Filtrar por canal" aria-expanded={showChannels} onClick={() => setShowChannels((v) => !v)}>
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
        <input placeholder="Buscar por nombre, N.º o email" aria-label="Buscar conversación" value={props.search} onChange={(e) => props.onSearch(e.target.value)} />
      </label>
      {showChannels && (
        <div className="channel-filter">
          {CHANNELS.map((c) => (
            <button key={c.value} className="fchip" aria-pressed={filter === c.value} onClick={() => onFilter(filter === c.value ? "ALL" : c.value)}>
              {c.value === "APP" ? <Smartphone size={13} aria-hidden /> : <Mail size={13} aria-hidden />} {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="tabs3" role="tablist">
        {TABS.map((t) => (
          <button key={t.value} role="tab" aria-selected={filter === t.value} onClick={() => onFilter(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConversationList(props: {
  list: ConversationRow[] | null;
  total: number | null;
  bot: BotStatus | null;
  filter: Filter;
  onFilter: (f: Filter) => void;
  search: string;
  onSearch: (s: string) => void;
  query: string;
  selected: string | null;
  onSelect: (id: string) => void;
  error: string;
}) {
  const { list } = props;
  return (
    <aside className="inbox-list" aria-label="Conversaciones">
      <ListHead total={props.total} bot={props.bot} filter={props.filter} onFilter={props.onFilter} search={props.search} onSearch={props.onSearch} />
      <div className="chats" role="listbox">
        {list?.map((c) => <ChatRow key={c.id} c={c} selected={c.id === props.selected} onSelect={() => props.onSelect(c.id)} />)}
        {list && list.length === 0 && (
          <div className="empty" style={{ padding: 32 }}>
            {emptyListText(props.filter, props.query)}
          </div>
        )}
        {props.error && (
          <p className="error" style={{ padding: 16 }}>
            {props.error}
          </p>
        )}
      </div>
    </aside>
  );
}
