"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { JobDetail, TransitionInput } from "@viavinilo/contracts";
import { api, downloadFile } from "../../../lib/api";
import { nextIntent, type PanelMode } from "./board-rules";
import { formIntent } from "./order-form";

/** El pedido completo; `load` lo vuelve a pedir. */
function useJobDetail(jobId: string, setError: (message: string | null) => void) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const load = useCallback(async () => {
    try {
      setJob(await api<JobDetail>(`/jobs/${jobId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [jobId, setError]);
  useEffect(() => {
    void load();
  }, [load]);
  return { job, load };
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

interface MutationDeps {
  jobId: string;
  load: () => Promise<void>;
  setMode: (mode: PanelMode) => void;
  setError: (message: string | null) => void;
  onChanged: () => void;
  onClose: () => void;
}

/** Los cambios sobre el pedido: marcan el panel ocupado, muestran el error y recargan. */
function useJobMutations({ jobId, load, setMode, setError, onChanged, onClose }: MutationDeps) {
  const [busy, setBusy] = useState(false);

  /** Un cambio sobre el pedido: vuelve a "ver", avisa al tablero y recarga el pedido. Dice si salió bien. */
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode("view");
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      await load();
      setBusy(false);
    }
  }

  const patch = (path: string, body: Record<string, unknown>) =>
    run(() => api(`/jobs/${jobId}/${path}`, { method: "PATCH", body: JSON.stringify(body) }));
  const move = (body: TransitionInput) =>
    run(() => api(`/jobs/${jobId}/transition`, { method: "POST", body: JSON.stringify(body) }));

  /** D-088: al eliminar no queda pedido que mostrar: se avisa al tablero y se cierra el panel. */
  function remove(reason: string) {
    setBusy(true);
    setError(null);
    api(`/jobs/${jobId}`, { method: "DELETE", body: JSON.stringify({ reason }) })
      .then(() => {
        onChanged();
        onClose();
      })
      .catch((err: unknown) => {
        setError((err as Error).message);
        setBusy(false);
      });
  }

  return { busy, patch, move, remove };
}

/** Estado y acciones del panel del pedido (D-079). */
export function useOrderPanel({
  jobId,
  initialMode,
  onClose,
  onChanged,
}: {
  jobId: string;
  initialMode: PanelMode;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const { job, load } = useJobDetail(jobId, setError);
  const { busy, patch, move, remove } = useJobMutations({
    jobId,
    load,
    setMode,
    setError,
    onChanged,
    onClose,
  });
  useEscape(onClose);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!job) return;
    const form = new FormData(e.currentTarget);
    const intent = formIntent(mode, (name) => String(form.get(name) || "").trim(), job.next);
    if (intent.kind === "invalid") setError(intent.message);
    else if (intent.kind === "move") void move(intent.body);
    else if (intent.kind === "delete") remove(intent.reason);
  }

  /** El botón de avance del panel; solo se muestra con el pedido cargado. */
  function clickNext(current: JobDetail) {
    const intent = nextIntent(current);
    if (intent.kind === "panel") setMode(intent.mode);
    else if (intent.kind === "move") void move({ to: intent.to });
  }

  const download = (file: { id: string; filename: string }) =>
    downloadFile(`/jobs/${jobId}/files/${file.id}`, file.filename).catch((e: unknown) =>
      setError((e as Error).message),
    );

  const backToView = () => {
    setMode("view");
    setError(null);
  };

  return { job, mode, setMode, backToView, busy, error, patch, submit, clickNext, download };
}

export type OrderPanelState = ReturnType<typeof useOrderPanel>;
