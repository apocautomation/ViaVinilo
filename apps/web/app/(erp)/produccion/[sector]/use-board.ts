"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Board, BoardCard, FileErrorReason, SectorRef } from "@viavinilo/contracts";
import { api, downloadFile, getUser, watchBoard } from "../../../lib/api";
import { boardQuery, type BoardIntent, type PanelMode } from "./board-rules";

const COMPACT_KEY = "vv.board.compact";

/**
 * Vista compacta (D-066): cada tarjeta ocupa 3 renglones, para que un tablero con muchos pedidos no
 * sea un scroll interminable. La elección se recuerda en el navegador.
 */
function useCompactPref() {
  const [compact, setCompact] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(COMPACT_KEY) === "0") setCompact(false);
    } catch {
      /* sin almacenamiento: queda compacta */
    }
  }, []);
  const toggle = (value: boolean) => {
    setCompact(value);
    try {
      localStorage.setItem(COMPACT_KEY, value ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  };
  return [compact, toggle] as const;
}

/** La hora actual, refrescada cada minuto para la antigüedad de las tarjetas. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Aviso que se borra solo a los 4,5 s. */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}

/** Filtros del tablero. Al cambiar de tablero, el sub-servicio y el material del anterior ya no sirven. */
function useBoardFilters(sector: string) {
  const [q, setQ] = useState("");
  const [machineId, setMachineId] = useState("");
  const [service, setService] = useState("");
  const [variant, setVariant] = useState("");
  const [groupByMaterial, setGroupByMaterial] = useState(false);
  useEffect(() => {
    setService("");
    setVariant("");
  }, [sector]);
  const query = useMemo(
    () => boardQuery({ sector, q, machineId, service, variant, groupByMaterial }),
    [sector, q, machineId, service, variant, groupByMaterial],
  );
  return {
    q,
    setQ,
    machineId,
    setMachineId,
    service,
    setService,
    variant,
    setVariant,
    groupByMaterial,
    setGroupByMaterial,
    query,
  };
}

export type BoardFilterState = ReturnType<typeof useBoardFilters>;

/** Lo que no cambia con los filtros: si es el dueño, los tableros y los motivos de error de archivo. */
function useBoardMeta() {
  const [isOwner, setIsOwner] = useState(false);
  const [sectors, setSectors] = useState<SectorRef[]>([]);
  const [reasons, setReasons] = useState<FileErrorReason[]>([]);
  useEffect(() => {
    setIsOwner(getUser()?.roles.includes("OWNER") ?? false);
    api<SectorRef[]>("/sectors")
      .then(setSectors)
      .catch(() => undefined);
    api<FileErrorReason[]>("/file-error-reasons")
      .then(setReasons)
      .catch(() => undefined);
  }, []);
  return { isOwner, sectors, reasons };
}

/** El tablero con sus filtros, recargado en tiempo real cuando entra o se mueve una orden del sector. */
function useLiveBoard(sector: string, query: string, onError: (message: string) => void) {
  const [board, setBoard] = useState<Board | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await api<Board>(`/jobs/board?${query}`));
    } catch (e) {
      onError((e as Error).message);
    }
  }, [query, onError]);

  // Búsqueda con una pequeña espera para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => watchBoard(sector, () => void load(), setLive), [sector, load]);
  return { board, live, load };
}

/**
 * D-062: descarga los archivos del pedido para imprimir (la API controla que esté liberado).
 * Devuelve el aviso para el operador, o null si bajó todo.
 */
async function downloadJobFiles(jobId: string): Promise<string | null> {
  try {
    const detail = await api<{ files: { id: string; filename: string }[] }>(`/jobs/${jobId}`);
    for (const f of detail.files) await downloadFile(`/jobs/${jobId}/files/${f.id}`, f.filename);
    return detail.files.length ? null : "Este pedido no tiene archivos guardados.";
  } catch (e) {
    return e instanceof Error ? e.message : "No pudimos descargar el archivo.";
  }
}

/** Tablero de un sector: carga, tiempo real, filtros y las acciones sobre las tarjetas. */
export function useBoard(sector: string) {
  const filters = useBoardFilters(sector);
  const [compact, setCompact] = useCompactPref();
  const now = useMinuteClock();
  const [toast, setToast] = useToast();
  const { isOwner, sectors, reasons } = useBoardMeta();
  const { board, live, load } = useLiveBoard(sector, filters.query, setToast);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ id: string; mode: PanelMode } | null>(null);

  /** Llama a la API por una tarjeta: la marca ocupada, avisa el error y recarga el tablero. */
  async function onCard(card: BoardCard, call: () => Promise<unknown>) {
    setBusy(card.id);
    try {
      await call();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      await load();
      setBusy(null);
    }
  }

  function apply(card: BoardCard, intent: BoardIntent) {
    if (intent.kind === "move")
      void onCard(card, () =>
        api(`/jobs/${card.id}/transition`, { method: "POST", body: JSON.stringify({ to: intent.to }) }),
      );
    else if (intent.kind === "panel") setPanel({ id: card.id, mode: intent.mode });
    else if (intent.kind === "toast") setToast(intent.message);
  }

  const assign = (card: BoardCard, machineId: string) =>
    onCard(card, () =>
      api(`/jobs/${card.id}/machine`, {
        method: "PATCH",
        body: JSON.stringify({ machineId: machineId || null }),
      }),
    );

  const downloadForPrint = (jobId: string) =>
    downloadJobFiles(jobId).then((problem) => problem && setToast(problem));

  return {
    board,
    sectors,
    reasons,
    isOwner,
    live,
    busy,
    toast,
    now,
    compact,
    setCompact,
    filters,
    panel,
    setPanel,
    load,
    apply,
    assign,
    downloadForPrint,
  };
}

export type BoardState = ReturnType<typeof useBoard>;
