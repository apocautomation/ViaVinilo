"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, ExternalLink, Pencil, X } from "lucide-react";
import { parseAmount, parseSaltaDateTime, PICKUP_BRANCHES, PICKUP_LABELS } from "@viavinilo/contracts";
import { api, downloadFile } from "../../../lib/api";
import { ars, MoneyInput } from "../../ui";

/**
 * Panel del pedido (D-079). Al tocar una tarjeta del tablero se abre acá el pedido completo: lo que
 * escribió el cliente, los archivos, el control del archivo, el historial y las acciones. Reemplaza a
 * la ventana emergente que solo pedía el precio y a la tarjeta que se abría dentro de la columna.
 */

export type PanelMode = "view" | "quote" | "error" | "cancel" | "force";

interface Detail {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  sector: { code: string; name: string };
  /** Tablero y sub-servicios entre los que se puede mover el pedido (D-082). */
  services: { code: string; name: string }[];
  customer: { id: string; number: number; name: string | null };
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  depositAmount: string | null;
  depositPaidAt: string | null;
  estimatedReadyAt: string | null;
  pickupBranch: string | null;
  fileCheck: { verdict: "ok" | "review" | "error" | "unknown"; detail: string; hint?: string; linkNote?: string } | null;
  machine: { id: string; name: string } | null;
  material: { id: string; name: string } | null;
  createdAt: string;
  next: string | null;
  other: string[];
  requestedSpecs: { subject?: string; body?: string; note?: string } | null;
  externalLinks: string[];
  files: { id: string; filename: string; sizeBytes: number; purgedAt: string | null }[];
  events: { id: string; toLabel: string; user: string | null; reason: string | null; note: string | null; createdAt: string }[];
}

const NEXT_ACTION: Record<string, string> = {
  RECEIVED: "Archivo corregido",
  QUOTED: "Cotizar",
  DEPOSIT_RECEIVED: "Registrar seña",
  PRINTED: "Marcar impreso",
  CALENDERING: "Pasar a calandra",
  READY: "Marcar terminado",
  DELIVERED: "Entregar",
};

const TZ = "America/Argentina/Salta";
const when = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function size(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const CHECK_TITLE: Record<string, string> = {
  ok: "Archivo controlado",
  review: "Revisar el archivo",
  error: "Archivo con problema",
  unknown: "No se pudo controlar solo",
};

export function OrderPanel(props: {
  jobId: string;
  initialMode: PanelMode;
  machines: { id: string; name: string }[];
  reasons: { id: string; label: string }[];
  isOwner: boolean;
  onClose: () => void;
  /** El pedido cambió: el tablero se recarga. */
  onChanged: () => void;
}) {
  const { jobId, onClose, onChanged } = props;
  const [job, setJob] = useState<Detail | null>(null);
  const [mode, setMode] = useState<PanelMode>(props.initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** D-086: la medida se corrige acá; null = no se está editando. */
  const [measureDraft, setMeasureDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setJob(await api<Detail>(`/jobs/${jobId}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode("view");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await load();
      setBusy(false);
    }
  }

  const move = (body: Record<string, unknown>) => run(() => api(`/jobs/${jobId}/transition`, { method: "POST", body: JSON.stringify(body) }));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!job) return;
    const f = new FormData(e.currentTarget);
    const text = (name: string) => String(f.get(name) || "").trim();
    if (mode === "quote") {
      const date = text("etaDate");
      const eta = date ? parseSaltaDateTime(date, text("etaTime")) : null;
      if (date && !eta) {
        setError("Escribí la fecha como día/mes/año (por ejemplo 24/11/2026) y la hora en 24 h (18:00).");
        return;
      }
      const price = parseAmount(text("amount"));
      const deposit = text("deposit");
      if (deposit && price && Number(parseAmount(deposit) ?? 0) > Number(price)) {
        setError("La seña no puede ser mayor que el precio.");
        return;
      }
      void move({ to: "QUOTED", quotedAmount: text("amount"), depositAmount: deposit || null, ...(eta ? { estimatedReadyAt: eta } : {}) });
    } else if (mode === "error") {
      void move({ to: "FILE_ERROR", reasonId: f.get("reason"), note: text("note") || undefined });
    } else if (mode === "cancel") {
      void move({ to: "CANCELLED", note: text("note") });
    } else if (mode === "force") {
      void move({ to: job.next === "DEPOSIT_RECEIVED" ? "PRINTED" : job.next, force: true, note: text("note") || undefined });
    }
  }

  function clickNext() {
    if (!job?.next) return;
    if (job.next === "QUOTED" && !job.quotedAmount) setMode("quote");
    else void move({ to: job.next });
  }

  async function download(file: { id: string; filename: string }) {
    try {
      await downloadFile(`/jobs/${jobId}/files/${file.id}`, file.filename);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const waitingDeposit = !!job && job.depositRequired && !job.depositPaidAt && job.status === "QUOTED";
  const saveMeasure = () =>
    run(async () => {
      await api(`/jobs/${jobId}/measure`, { method: "PATCH", body: JSON.stringify({ measure: (measureDraft ?? "").trim() }) });
      setMeasureDraft(null);
    });
  const message = job?.requestedSpecs?.body || job?.requestedSpecs?.note || "";

  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer order-panel" role="dialog" aria-modal="true" aria-label={job ? `Pedido ${job.label}` : "Pedido"}>
        <div className="drawer-head">
          <span className="order-panel-title">
            <strong>{job?.label ?? "Pedido"}</strong>
            {job && <span className="chip chip-brand">{waitingDeposit ? "Esperando seña" : job.statusLabel}</span>}
            {job && <span className="muted">{job.sector.name}</span>}
          </span>
          <button className="btn btn-ghost btn-sm icon-only" aria-label="Cerrar el pedido" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </div>

        {!job && <p className="order-panel-body muted">{error ?? "Cargando el pedido…"}</p>}

        {job && (
          <div className="order-panel-body">
            {error && (
              <p className="file-check error" role="alert">
                {error}
              </p>
            )}

            <section className="order-block">
              <h3>Cliente</h3>
              <p className="order-strong">
                {job.customer.name ?? "Cliente sin nombre"} <span className="muted">· Cliente N.º {job.customer.number}</span>
              </p>
              <p className="muted">Entró el {when.format(new Date(job.createdAt))}</p>
            </section>

            <section className="order-block">
              <h3>Pedido</h3>
              {job.description && <p className="order-strong">{job.description}</p>}
              {message && <p className="order-message">{message}</p>}
              <dl className="kv order-kv">
                <dt>Medida</dt>
                <dd>
                  {measureDraft === null ? (
                    <>
                      {job.measure || "No la escribió"}{" "}
                      <button type="button" className="btn btn-ghost btn-sm icon-only" aria-label="Corregir la medida" title="Corregir la medida" disabled={busy} onClick={() => setMeasureDraft(job.measure ?? "")}>
                        <Pencil size={13} aria-hidden />
                      </button>
                    </>
                  ) : (
                    <span className="order-measure-edit">
                      <input
                        value={measureDraft}
                        onChange={(e) => setMeasureDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void saveMeasure()}
                        maxLength={80}
                        placeholder="Ej.: 58 x 100 cm"
                        aria-label="Medida pedida"
                        autoFocus
                      />
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveMeasure()}>
                        Guardar
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMeasureDraft(null)}>
                        Volver
                      </button>
                    </span>
                  )}
                </dd>
                {job.material && (
                  <>
                    <dt>Material</dt>
                    <dd>{job.material.name}</dd>
                  </>
                )}
                <dt>Precio</dt>
                <dd>{job.quotedAmount ? ars.format(Number(job.quotedAmount)) : "Sin cotizar"}</dd>
                {job.depositRequired && (
                  <>
                    <dt>Seña</dt>
                    <dd>
                      {job.depositAmount ? `${ars.format(Number(job.depositAmount))} · ` : ""}
                      {job.depositPaidAt ? "recibida" : "pendiente"}
                    </dd>
                  </>
                )}
                {job.estimatedReadyAt && (
                  <>
                    <dt>Listo para retirar</dt>
                    <dd>{when.format(new Date(job.estimatedReadyAt))}</dd>
                  </>
                )}
              </dl>
            </section>

            <section className="order-block">
              <h3>Archivos</h3>
              {job.files.length === 0 && <p className="muted">Este pedido no tiene archivos guardados.</p>}
              <ul className="order-files">
                {job.files.map((f) => (
                  <li key={f.id}>
                    <span className="order-file-name" title={f.filename}>
                      {f.filename} <small className="muted">{size(f.sizeBytes)}</small>
                    </span>
                    {f.purgedAt ? (
                      <span className="muted">Ya no está disponible</span>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void download(f)}>
                        <Download size={14} aria-hidden /> Descargar
                      </button>
                    )}
                  </li>
                ))}
                {job.externalLinks.map((link) => (
                  <li key={link}>
                    <a className="order-file-name" href={link} target="_blank" rel="noreferrer noopener" title={link}>
                      <ExternalLink size={13} aria-hidden /> {link}
                    </a>
                  </li>
                ))}
              </ul>
              {job.fileCheck && (
                <p className={`file-check ${job.fileCheck.verdict === "unknown" ? "hint" : job.fileCheck.verdict}`}>
                  <b>{CHECK_TITLE[job.fileCheck.verdict]}:</b> {job.fileCheck.detail}
                </p>
              )}
              {job.fileCheck?.linkNote && (
                <p className="file-check review">
                  <b>Link sin bajar:</b> {job.fileCheck.linkNote}
                </p>
              )}
            </section>

            {job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
              <section className="order-block">
                <h3>Retiro</h3>
                <select
                  value={job.pickupBranch ?? ""}
                  disabled={busy}
                  aria-label="Sucursal donde retira"
                  onChange={(e) => void run(() => api(`/jobs/${jobId}/pickup`, { method: "PATCH", body: JSON.stringify({ branch: e.target.value || null }) }))}
                >
                  <option value="">Sin definir</option>
                  {PICKUP_BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      Retira en {PICKUP_LABELS[b]}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {job.services.length > 0 && job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
              <section className="order-block">
                <h3>Servicio</h3>
                <select
                  value={job.sector.code}
                  disabled={busy}
                  aria-label="Servicio del pedido"
                  onChange={(e) => void run(() => api(`/jobs/${jobId}/service`, { method: "PATCH", body: JSON.stringify({ sector: e.target.value }) }))}
                >
                  {job.services.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {job.status !== "DELIVERED" && job.status !== "CANCELLED" && props.machines.length > 0 && (
              <section className="order-block">
                <h3>Máquina</h3>
                <select
                  value={job.machine?.id ?? ""}
                  disabled={busy}
                  aria-label="Máquina del pedido"
                  onChange={(e) => void run(() => api(`/jobs/${jobId}/machine`, { method: "PATCH", body: JSON.stringify({ machineId: e.target.value || null }) }))}
                >
                  <option value="">Sin máquina asignada</option>
                  {props.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {mode !== "view" && (
              <form className="order-block order-form" onSubmit={submit}>
                {mode === "quote" && (
                  <>
                    <h3>Cotizar</h3>
                    <label className="field">
                      Precio (pesos)
                      <MoneyInput name="amount" placeholder="Ej.: 20.000" defaultValue={job.quotedAmount ? job.quotedAmount.replace(".", ",") : ""} required autoFocus />
                    </label>
                    <label className="field">
                      Seña que tiene que dejar (opcional)
                      <MoneyInput name="deposit" placeholder="Ej.: 10.000 · vacío si no lleva seña" defaultValue={job.depositAmount ? job.depositAmount.replace(".", ",") : ""} />
                      <small className="muted">Si cargás un monto, el cliente lo ve en su app y el pedido queda esperando la seña.</small>
                    </label>
                    <div className="order-two">
                      <label className="field">
                        Listo para retirar (opcional)
                        <input name="etaDate" inputMode="numeric" placeholder="día/mes/año · 24/11/2026" maxLength={10} autoComplete="off" />
                      </label>
                      <label className="field">
                        Hora (24 h)
                        <input name="etaTime" inputMode="numeric" placeholder="18:00" maxLength={5} autoComplete="off" />
                      </label>
                    </div>
                  </>
                )}
                {mode === "error" && (
                  <>
                    <h3>Error de archivo</h3>
                    <label className="field">
                      Motivo
                      <select name="reason" required defaultValue="">
                        <option value="" disabled>
                          Elegí el motivo
                        </option>
                        {props.reasons.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Detalle para el cliente (opcional)
                      <textarea name="note" rows={2} maxLength={500} />
                    </label>
                  </>
                )}
                {mode === "cancel" && (
                  <>
                    <h3>Cancelar el pedido</h3>
                    <label className="field">
                      Motivo
                      <textarea name="note" rows={2} maxLength={500} required autoFocus />
                    </label>
                  </>
                )}
                {mode === "force" && (
                  <>
                    <h3>Imprimir sin seña</h3>
                    <p className="muted">Queda registrado que lo autorizaste vos.</p>
                    <label className="field">
                      Motivo (opcional)
                      <textarea name="note" rows={2} maxLength={500} />
                    </label>
                  </>
                )}
                <div className="order-actions">
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => (setMode("view"), setError(null))}>
                    Volver
                  </button>
                  <button className="btn btn-primary" disabled={busy}>
                    Confirmar
                  </button>
                </div>
              </form>
            )}

            {mode === "view" && (job.next || job.other.length > 0) && (
              <section className="order-block">
                {job.next && (
                  <button className="btn btn-primary btn-big" disabled={busy} onClick={clickNext}>
                    {NEXT_ACTION[job.next] ?? "Avanzar"}
                  </button>
                )}
                <div className="order-actions">
                  {job.other.includes("FILE_ERROR") && (
                    <button className="btn btn-danger" disabled={busy} onClick={() => setMode("error")}>
                      Error de archivo
                    </button>
                  )}
                  {props.isOwner && job.next === "DEPOSIT_RECEIVED" && (
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setMode("force")}>
                      Imprimir sin seña
                    </button>
                  )}
                  {job.other.includes("CANCELLED") && (
                    <button className="btn btn-ghost" disabled={busy} onClick={() => setMode("cancel")}>
                      Cancelar
                    </button>
                  )}
                </div>
              </section>
            )}

            {job.events.length > 0 && (
              <section className="order-block">
                <h3>Historial</h3>
                <ul className="order-history">
                  {job.events.map((ev) => (
                    <li key={ev.id}>
                      <span>
                        <b>{ev.toLabel}</b>
                        {ev.reason ? ` · ${ev.reason}` : ""}
                        {ev.note ? ` · ${ev.note}` : ""}
                      </span>
                      <small className="muted">
                        {when.format(new Date(ev.createdAt))}
                        {ev.user ? ` · ${ev.user}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
