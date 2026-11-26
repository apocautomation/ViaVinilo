import { useState } from "react";
import { Download, ExternalLink, Pencil } from "lucide-react";
import {
  PICKUP_BRANCHES,
  PICKUP_LABELS,
  type FileErrorReason,
  type JobDetail,
  type MachineRef,
} from "@viavinilo/contracts";
import { ars, MoneyInput } from "../../ui";
import { FILE_CHECK_TITLE, isOpenJob, type PanelMode } from "./board-rules";
import { LinkNote } from "./job-actions";
import type { OrderPanelState } from "./use-order-panel";

const TZ = "America/Argentina/Salta";
const when = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function size(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CustomerBlock({ job }: { job: JobDetail }) {
  return (
    <section className="order-block">
      <h3>Cliente</h3>
      <p className="order-strong">
        {job.customer.name ?? "Cliente sin nombre"}{" "}
        <span className="muted">· Cliente N.º {job.customer.number}</span>
      </p>
      <p className="muted">Entró el {when.format(new Date(job.createdAt))}</p>
    </section>
  );
}

/** D-086: la medida se corrige acá. */
function MeasureField({ job, p }: { job: JobDetail; p: OrderPanelState }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    if (await p.patch("measure", { measure: (draft ?? "").trim() })) setDraft(null);
  };
  if (draft === null) {
    return (
      <>
        {job.measure || "No la escribió"}{" "}
        <button
          type="button"
          className="btn btn-ghost btn-sm icon-only"
          aria-label="Corregir la medida"
          title="Corregir la medida"
          disabled={p.busy}
          onClick={() => setDraft(job.measure ?? "")}
        >
          <Pencil size={13} aria-hidden />
        </button>
      </>
    );
  }
  return (
    <span className="order-measure-edit">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void save()}
        maxLength={80}
        placeholder="Ej.: 58 x 100 cm"
        aria-label="Medida pedida"
        autoFocus
      />
      <button type="button" className="btn btn-primary btn-sm" disabled={p.busy} onClick={() => void save()}>
        Guardar
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={p.busy} onClick={() => setDraft(null)}>
        Volver
      </button>
    </span>
  );
}

export function OrderBlock({ job, p }: { job: JobDetail; p: OrderPanelState }) {
  const message = job.requestedSpecs?.body || job.requestedSpecs?.note || "";
  return (
    <section className="order-block">
      <h3>Pedido</h3>
      {job.description && <p className="order-strong">{job.description}</p>}
      {message && <p className="order-message">{message}</p>}
      <dl className="kv order-kv">
        <dt>Medida</dt>
        <dd>
          <MeasureField job={job} p={p} />
        </dd>
        {job.material && (
          <>
            <dt>Opción de impresión</dt>
            <dd>{job.material.name}</dd>
          </>
        )}
        <MoneyRows job={job} />
      </dl>
    </section>
  );
}

/** Precio, seña y hora estimada de retiro. */
function MoneyRows({ job }: { job: JobDetail }) {
  return (
    <>
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
    </>
  );
}

export function FilesBlock({ job, p }: { job: JobDetail; p: OrderPanelState }) {
  return (
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
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void p.download(f)}>
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
          <b>{FILE_CHECK_TITLE[job.fileCheck.verdict]}:</b> {job.fileCheck.detail}
        </p>
      )}
      <LinkNote check={job.fileCheck} />
    </section>
  );
}

/** Una lista del panel que cambia un dato del pedido apenas se elige otra opción. */
function SettingSelect({
  title,
  label,
  value,
  disabled,
  empty,
  options,
  onChange,
}: {
  title: string;
  label: string;
  value: string;
  disabled: boolean;
  /** Texto de la opción vacía; sin él, la lista no se puede dejar vacía. */
  empty?: string;
  options: { value: string; text: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <section className="order-block">
      <h3>{title}</h3>
      <select value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    </section>
  );
}

type SettingProps = { job: JobDetail; p: OrderPanelState };

function PickupSetting({ job, p }: SettingProps) {
  if (!isOpenJob(job)) return null;
  return (
    <SettingSelect
      title="Retiro"
      label="Sucursal donde retira"
      value={job.pickupBranch ?? ""}
      disabled={p.busy}
      empty="Sin definir"
      options={PICKUP_BRANCHES.map((b) => ({ value: b, text: `Retira en ${PICKUP_LABELS[b]}` }))}
      onChange={(v) => void p.patch("pickup", { branch: v || null })}
    />
  );
}

function VariantSetting({ job, p }: SettingProps) {
  if (job.variants.length === 0 && !job.variant) return null;
  return (
    <SettingSelect
      title="Opción de impresión"
      label="Opción de impresión del pedido"
      value={job.variant?.id ?? ""}
      disabled={p.busy || !isOpenJob(job)}
      empty="Sin definir"
      options={job.variants.map((v) => ({ value: v.id, text: `${v.code} · ${v.name}` }))}
      onChange={(v) => void p.patch("variant", { variantId: v || null })}
    />
  );
}

function ServiceSetting({ job, p }: SettingProps) {
  if (job.services.length === 0 || !isOpenJob(job)) return null;
  return (
    <SettingSelect
      title="Servicio"
      label="Servicio del pedido"
      value={job.sector.code}
      disabled={p.busy}
      options={job.services.map((s) => ({ value: s.code, text: s.name }))}
      onChange={(v) => void p.patch("service", { sector: v })}
    />
  );
}

function MachineSetting({ job, p, machines }: SettingProps & { machines: readonly MachineRef[] }) {
  if (!isOpenJob(job) || machines.length === 0) return null;
  return (
    <SettingSelect
      title="Máquina"
      label="Máquina del pedido"
      value={job.machine?.id ?? ""}
      disabled={p.busy}
      empty="Sin máquina asignada"
      options={machines.map((m) => ({ value: m.id, text: m.name }))}
      onChange={(v) => void p.patch("machine", { machineId: v || null })}
    />
  );
}

/** Retiro, opción de impresión, servicio y máquina: cada uno se guarda al elegirlo. */
export function SettingsBlocks({ job, p, machines }: SettingProps & { machines: readonly MachineRef[] }) {
  return (
    <>
      <PickupSetting job={job} p={p} />
      <VariantSetting job={job} p={p} />
      <ServiceSetting job={job} p={p} />
      <MachineSetting job={job} p={p} machines={machines} />
    </>
  );
}

function QuoteFields({ job }: { job: JobDetail }) {
  return (
    <>
      <h3>Cotizar</h3>
      <label className="field">
        Precio (pesos)
        <MoneyInput
          name="amount"
          placeholder="Ej.: 20.000"
          defaultValue={job.quotedAmount ? job.quotedAmount.replace(".", ",") : ""}
          required
          autoFocus
        />
      </label>
      <label className="field">
        Seña que tiene que dejar (opcional)
        <MoneyInput
          name="deposit"
          placeholder="Ej.: 10.000 · vacío si no lleva seña"
          defaultValue={job.depositAmount ? job.depositAmount.replace(".", ",") : ""}
        />
        <small className="muted">
          Si cargás un monto, el cliente lo ve en su app y el pedido queda esperando la seña.
        </small>
      </label>
      <div className="order-two">
        <label className="field">
          Listo para retirar (opcional)
          <input
            name="etaDate"
            inputMode="numeric"
            placeholder="día/mes/año · 24/11/2026"
            maxLength={10}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Hora (24 h)
          <input name="etaTime" inputMode="numeric" placeholder="18:00" maxLength={5} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

function ErrorFields({ reasons }: { reasons: readonly FileErrorReason[] }) {
  return (
    <>
      <h3>Error de archivo</h3>
      <label className="field">
        Motivo
        <select name="reason" required defaultValue="">
          <option value="" disabled>
            Elegí el motivo
          </option>
          {reasons.map((r) => (
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
  );
}

function ModeFields({
  mode,
  job,
  reasons,
}: {
  mode: PanelMode;
  job: JobDetail;
  reasons: readonly FileErrorReason[];
}) {
  switch (mode) {
    case "quote":
      return <QuoteFields job={job} />;
    case "error":
      return <ErrorFields reasons={reasons} />;
    case "cancel":
      return (
        <>
          <h3>Cancelar el pedido</h3>
          <label className="field">
            Motivo
            <textarea name="note" rows={2} maxLength={500} required autoFocus />
          </label>
        </>
      );
    case "delete":
      return (
        <>
          <h3>Eliminar el pedido</h3>
          <p className="file-check error">
            <b>{job.label} deja de verse</b> en el tablero, en los listados y en la app del cliente. No se le
            avisa al cliente y no se puede deshacer desde el sistema. Si el cliente lo dio de baja, usá
            «Cancelar».
          </p>
          <label className="field">
            ¿Por qué se elimina?
            <textarea
              name="note"
              rows={2}
              minLength={3}
              maxLength={300}
              required
              autoFocus
              placeholder="Ej.: pedido de prueba, duplicado, cargado por error"
            />
          </label>
        </>
      );
    case "force":
      return (
        <>
          <h3>Imprimir sin seña</h3>
          <p className="muted">Queda registrado que lo autorizaste vos.</p>
          <label className="field">
            Motivo (opcional)
            <textarea name="note" rows={2} maxLength={500} />
          </label>
        </>
      );
    case "view":
      return null;
  }
}

/** El formulario del modo abierto: cotizar, error de archivo, cancelar, eliminar o imprimir sin seña. */
export function ModeForm({
  job,
  p,
  reasons,
}: {
  job: JobDetail;
  p: OrderPanelState;
  reasons: readonly FileErrorReason[];
}) {
  const deleting = p.mode === "delete";
  return (
    <form className="order-block order-form" onSubmit={p.submit}>
      <ModeFields mode={p.mode} job={job} reasons={reasons} />
      <div className="order-actions">
        <button type="button" className="btn btn-ghost" disabled={p.busy} onClick={p.backToView}>
          Volver
        </button>
        <button className={deleting ? "btn btn-danger" : "btn btn-primary"} disabled={p.busy}>
          {deleting ? "Eliminar el pedido" : "Confirmar"}
        </button>
      </div>
    </form>
  );
}

export function HistoryBlock({ job }: { job: JobDetail }) {
  if (job.events.length === 0) return null;
  return (
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
  );
}
