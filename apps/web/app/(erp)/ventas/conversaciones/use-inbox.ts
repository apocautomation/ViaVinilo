"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationRow, ConversationThread } from "@viavinilo/contracts";
import { api } from "../../../lib/api";
import { errorText, listQuery, REFRESH_MS, type BotStatus, type Filter } from "./inbox";

/** La búsqueda se manda 300 ms después de la última tecla. */
function useDebouncedTrim(value: string): string {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return debounced;
}

/** Estado general del bot; se vuelve a pedir cuando cambia el bot o la derivación del hilo abierto. */
function useBotStatus(thread: ConversationThread | null) {
  const [bot, setBot] = useState<BotStatus | null>(null);
  const botEnabled = thread?.botEnabled;
  const needsHuman = thread?.needsHuman;
  useEffect(() => {
    api<BotStatus>("/conversations/bot").then(setBot).catch(() => setBot(null));
  }, [botEnabled, needsHuman]);
  return [bot, setBot] as const;
}

/**
 * Estado de la bandeja: el listado con su filtro y búsqueda, el hilo abierto y el estado del bot.
 * Las dos cosas se refrescan cada `REFRESH_MS` hasta tener avisos en vivo.
 */
export function useInbox() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const query = useDebouncedTrim(search);
  const [list, setList] = useState<ConversationRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [error, setError] = useState("");
  const [botBusy, setBotBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await api<{ items: ConversationRow[]; total: number }>(`/conversations?${listQuery(filter, query)}`);
      setList(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(errorText(e));
    }
  }, [filter, query]);

  const loadThread = useCallback(async (id: string, markRead: boolean) => {
    try {
      setThread(await api<ConversationThread>(`/conversations/${id}`));
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

  const [bot, setBot] = useBotStatus(thread);

  /** Vuelve a leer el hilo abierto y el listado, después de un cambio hecho desde el hilo. */
  const refresh = useCallback(() => {
    if (thread) void loadThread(thread.id, false).then(loadList);
  }, [thread, loadThread, loadList]);

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

  return {
    filter,
    setFilter,
    search,
    setSearch,
    query,
    list,
    total,
    selected,
    setSelected,
    thread,
    error,
    setError,
    bot,
    setBot,
    botBusy,
    toggleChatBot,
    refresh,
  };
}
