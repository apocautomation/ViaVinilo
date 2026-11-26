"use client";

import { Trash2, X } from "lucide-react";
import type { FileErrorReason, JobDetail, MachineRef } from "@viavinilo/contracts";
import type { PanelMode } from "./board-rules";
import { NextButton, SideActions } from "./job-actions";
import {
  CustomerBlock,
  FilesBlock,
  HistoryBlock,
  ModeForm,
  OrderBlock,
  SettingsBlocks,
} from "./order-sections";
import { useOrderPanel, type OrderPanelState } from "./use-order-panel";

/**
 * Panel del pedido (D-079). Al tocar una tarjeta del tablero se abre acá el pedido completo: lo que
 * escribió el cliente, los archivos, el control del archivo, el historial y las acciones. Reemplaza a
 * la ventana emergente que solo pedía el precio y a la tarjeta que se abría dentro de la columna.
 */
export function OrderPanel(props: {
  jobId: string;
  initialMode: PanelMode;
  machines: readonly MachineRef[];
  reasons: readonly FileErrorReason[];
  isOwner: boolean;
  onClose: () => void;
  /** El pedido cambió: el tablero se recarga. */
  onChanged: () => void;
}) {
  const p = useOrderPanel(props);
  const { job } = p;
  const { onClose } = props;
  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="drawer order-panel"
        role="dialog"
        aria-modal="true"
        aria-label={job ? `Pedido ${job.label}` : "Pedido"}
      >
        <PanelHead job={job} onClose={onClose} />
        {!job && <p className="order-panel-body muted">{p.error ?? "Cargando el pedido…"}</p>}
        {job && (
          <div className="order-panel-body">
            {p.error && (
              <p className="file-check error" role="alert">
                {p.error}
              </p>
            )}
            <CustomerBlock job={job} />
            <OrderBlock job={job} p={p} />
            <FilesBlock job={job} p={p} />
            <SettingsBlocks job={job} p={p} machines={props.machines} />
            {p.mode !== "view" && <ModeForm job={job} p={p} reasons={props.reasons} />}
            {p.mode === "view" && <ViewActions job={job} p={p} isOwner={props.isOwner} />}
            <HistoryBlock job={job} />
          </div>
        )}
      </aside>
    </div>
  );
}

function PanelTitle({ job }: { job: JobDetail }) {
  const waitingDeposit = job.depositRequired && !job.depositPaidAt && job.status === "QUOTED";
  return (
    <>
      {job.code !== job.label && <span className="muted">{job.label}</span>}
      <span className="chip chip-brand">{waitingDeposit ? "Esperando seña" : job.statusLabel}</span>
      <span className="muted">{job.sector.name}</span>
    </>
  );
}

function PanelHead({ job, onClose }: { job: JobDetail | null; onClose: () => void }) {
  return (
    <div className="drawer-head">
      <span className="order-panel-title">
        <strong>{job?.code ?? "Pedido"}</strong>
        {job && <PanelTitle job={job} />}
      </span>
      <button className="btn btn-ghost btn-sm icon-only" aria-label="Cerrar el pedido" onClick={onClose}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/** Avance, acciones del costado y, para el dueño, eliminar el pedido. */
function ViewActions({ job, p, isOwner }: { job: JobDetail; p: OrderPanelState; isOwner: boolean }) {
  return (
    <>
      {(job.next || job.other.length > 0) && (
        <section className="order-block">
          <NextButton next={job.next} size="big" disabled={p.busy} onClick={() => p.clickNext(job)} />
          <div className="order-actions">
            <SideActions
              next={job.next}
              other={job.other}
              isOwner={isOwner}
              disabled={p.busy}
              onPick={p.setMode}
            />
          </div>
        </section>
      )}
      {isOwner && (
        <button
          type="button"
          className="btn btn-ghost order-delete"
          disabled={p.busy}
          onClick={() => p.setMode("delete")}
        >
          <Trash2 size={14} aria-hidden /> Eliminar pedido
        </button>
      )}
    </>
  );
}
