import type { DragEvent } from "react";
import { Clock, Download, Paperclip } from "lucide-react";
import {
  isPickupBranch,
  PICKUP_LABELS,
  type BoardCard,
  type JobStatus,
  type MachineRef,
} from "@viavinilo/contracts";
import { ars, initials } from "../../ui";
import {
  ageLabel,
  FILE_CHECK_TITLE,
  isLate,
  isOpenJob,
  nextIntent,
  waitingDeposit,
  type BoardIntent,
  type PanelMode,
} from "./board-rules";
import { LinkNote, NextButton, SideActions } from "./job-actions";

/** Siempre hora de Salta y en 24 h, sin importar cómo esté configurada la PC del taller. */
const TZ = "America/Argentina/Salta";
const readyAt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fullDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  dateStyle: "short",
  timeStyle: "short",
  hourCycle: "h23",
});

/** Pasos en que el operador puede bajar el archivo para imprimir (D-062). */
const DOWNLOADABLE: readonly JobStatus[] = ["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED"];

export interface CardContext {
  now: number;
  busy: boolean;
  dragging: boolean;
  isOwner: boolean;
  /** Pasos de la secuencia del tablero, para la barra de avance. */
  flow: readonly JobStatus[];
  machines: readonly MachineRef[];
  /** D-110: agrupado por opción, el encabezado del grupo ya dice cuántos son. */
  grouped: boolean;
  onIntent: (intent: BoardIntent) => void;
  onAssign: (machineId: string) => void;
  onDownload: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const depositAmount = (card: BoardCard) => (card.depositAmount ? ars.format(Number(card.depositAmount)) : "");
const depositLabel = (card: BoardCard) =>
  `Esperando seña${card.depositAmount ? ` de ${depositAmount(card)}` : ""}`;

function dragProps(card: BoardCard, ctx: CardContext) {
  return {
    draggable: true,
    "aria-busy": ctx.busy,
    "data-dragging": ctx.dragging,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.label);
      ctx.onDragStart();
    },
    onDragEnd: ctx.onDragEnd,
  };
}

function CardNumber({ card }: { card: BoardCard }) {
  return (
    <>
      {card.code}
      {card.code !== card.label && <small className="num-vv">{card.label}</small>}
    </>
  );
}

function Age({ card, now, withTitle }: { card: BoardCard; now: number; withTitle?: boolean }) {
  return (
    <span
      className="age"
      data-late={isLate(card.createdAt, now)}
      title={withTitle ? fullDate.format(new Date(card.createdAt)) : undefined}
    >
      <Clock size={12} aria-hidden /> {ageLabel(card.createdAt, now)}
    </span>
  );
}

export function CardView({ card, compact, ctx }: { card: BoardCard; compact: boolean; ctx: CardContext }) {
  return compact ? <CompactCard card={card} ctx={ctx} /> : <FullCard card={card} ctx={ctx} />;
}

/** Tarjeta de 3 renglones (D-066). Al tocarla se abre el panel del pedido (D-079). */
function CompactCard({ card, ctx }: { card: BoardCard; ctx: CardContext }) {
  const open = () => ctx.onIntent({ kind: "panel", mode: "view" });
  return (
    <article className="card card-compact" {...dragProps(card, ctx)}>
      {/* Es un div y no un botón para que la tarjeta se pueda arrastrar también en Firefox (D-086). */}
      <div
        role="button"
        tabIndex={0}
        className="card-toggle"
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
        title="Abrir el pedido"
      >
        <span className="row">
          <span className="num" title={card.label}>
            <CardNumber card={card} />
          </span>
          <Age card={card} now={ctx.now} />
        </span>
        <span className="row">
          <span className="who-line">{card.customer.name ?? `Cliente N.º ${card.customer.number}`}</span>
          <CompactMarks card={card} />
        </span>
        {card.description && <CompactDescription card={card} />}
      </div>
      <NextButton
        next={card.next}
        size="sm"
        disabled={ctx.busy}
        onClick={() => ctx.onIntent(nextIntent(card))}
      />
    </article>
  );
}

function CompactMarks({ card }: { card: BoardCard }) {
  const check = card.status === "RECEIVED" ? card.fileCheck?.verdict : undefined;
  return (
    <span className="mini">
      {(check === "error" || check === "review") && (
        <span className={`dot ${check}`} title={card.fileCheck?.detail} />
      )}
      {card.quotedAmount && <span>{ars.format(Number(card.quotedAmount))}</span>}
      {waitingDeposit(card) && (
        <span className="warn" title={depositLabel(card)}>
          Seña{card.depositAmount ? ` ${depositAmount(card)}` : ""}
        </span>
      )}
    </span>
  );
}

function CompactDescription({ card }: { card: BoardCard }) {
  return (
    <span className="desc-line">
      {card.variant && (
        <b className="service-tag" title={card.variant.name}>
          {card.variant.code}
        </b>
      )}
      {card.service && <b className="service-tag">{card.service.name}</b>}
      {isPickupBranch(card.pickupBranch) && (
        <b className="service-tag">→ {PICKUP_LABELS[card.pickupBranch]}</b>
      )}
      {card.description}
    </span>
  );
}

function FullCard({ card, ctx }: { card: BoardCard; ctx: CardContext }) {
  const open = (mode: PanelMode) => ctx.onIntent({ kind: "panel", mode });
  const active = isOpenJob(card);
  return (
    <article className="card" {...dragProps(card, ctx)}>
      <header>
        <button type="button" className="num num-btn" onClick={() => open("view")} title="Abrir el pedido">
          <CardNumber card={card} />
        </button>
        <Age card={card} now={ctx.now} withTitle />
      </header>
      <CardWho card={card} />
      {card.description && <div className="desc">{card.description}</div>}
      <StepsBar flow={ctx.flow} step={ctx.flow.indexOf(card.status)} />
      <CardChips card={card} grouped={ctx.grouped} />
      {active && (
        <MachineSelect card={card} machines={ctx.machines} disabled={ctx.busy} onChange={ctx.onAssign} />
      )}
      {card.status === "RECEIVED" && <ReceivedFileCheck card={card} />}
      {card.fileCount > 0 && DOWNLOADABLE.includes(card.status) && (
        <button className="btn btn-ghost" onClick={ctx.onDownload}>
          <Download size={14} aria-hidden /> Descargar archivo
        </button>
      )}
      <NextButton
        next={card.next}
        size="big"
        disabled={ctx.busy}
        onClick={() => ctx.onIntent(nextIntent(card))}
      />
      <CardSideActions card={card} ctx={ctx} />
    </article>
  );
}

function CardSideActions({ card, ctx }: { card: BoardCard; ctx: CardContext }) {
  if (card.other.length === 0 && !(ctx.isOwner && card.next === "DEPOSIT_RECEIVED")) return null;
  return (
    <div className="actions">
      <SideActions
        next={card.next}
        other={card.other}
        isOwner={ctx.isOwner}
        disabled={ctx.busy}
        onPick={(mode) => ctx.onIntent({ kind: "panel", mode })}
      />
    </div>
  );
}

function CardWho({ card }: { card: BoardCard }) {
  return (
    <div className="who">
      <span className="avatar avatar-sm">{initials(card.customer.name)}</span>
      <span>
        {card.customer.name ?? "Cliente sin nombre"}
        <small>Cliente N.º {card.customer.number}</small>
      </span>
    </div>
  );
}

/** Barra de avance: un segmento por paso de la secuencia del tablero. */
function StepsBar({ flow, step }: { flow: readonly JobStatus[]; step: number }) {
  if (step < 0) return null;
  return (
    <div className="steps" aria-label={`Paso ${step + 1} de ${flow.length}`}>
      {flow.map((s, i) => (
        <span key={s} data-done={i <= step} />
      ))}
    </div>
  );
}

function MoneyChips({ card }: { card: BoardCard }) {
  return (
    <>
      {card.quotedAmount && <span className="chip chip-brand">{ars.format(Number(card.quotedAmount))}</span>}
      {waitingDeposit(card) && <span className="chip chip-warn">{depositLabel(card)}</span>}
    </>
  );
}

function CardChips({ card, grouped }: { card: BoardCard; grouped: boolean }) {
  return (
    <div className="chips">
      {card.service && <span className="chip chip-brand">{card.service.name}</span>}
      <span className="chip">
        <Paperclip size={12} aria-hidden /> {card.fileCount} {card.fileCount === 1 ? "archivo" : "archivos"}
      </span>
      {card.linkCount > 0 && <span className="chip">{card.linkCount} link</span>}
      <MoneyChips card={card} />
      {isPickupBranch(card.pickupBranch) && (
        <span className="chip">Retira en {PICKUP_LABELS[card.pickupBranch]}</span>
      )}
      <MaterialChip card={card} />
      {!grouped && card.sameMaterialCount > 0 && (
        <span className="chip chip-brand">+{card.sameMaterialCount} con la misma opción</span>
      )}
      {card.estimatedReadyAt && (
        <span className="chip">Listo {readyAt.format(new Date(card.estimatedReadyAt))}</span>
      )}
    </div>
  );
}

function MaterialChip({ card }: { card: BoardCard }) {
  if (card.variant) {
    return (
      <span className="chip chip-brand" title={card.variant.name}>
        {card.variant.code} · {card.variant.name}
      </span>
    );
  }
  return card.material ? <span className="chip">{card.material.name}</span> : null;
}

function MachineSelect({
  card,
  machines,
  disabled,
  onChange,
}: {
  card: BoardCard;
  machines: readonly MachineRef[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={card.machine?.id ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={`Máquina de ${card.label}`}
    >
      <option value="">Sin máquina asignada</option>
      {machines.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/** Resultado del control automático del archivo mientras el pedido está recibido (D-065). */
function ReceivedFileCheck({ card }: { card: BoardCard }) {
  const check = card.fileCheck;
  if (!check) return null;
  return (
    <>
      {(check.verdict === "error" || check.verdict === "review") && (
        <p className={`file-check ${check.verdict}`} title={check.detail}>
          <b>{FILE_CHECK_TITLE[check.verdict]}:</b> {check.detail}
        </p>
      )}
      {check.verdict === "ok" && <p className="file-check ok">Archivo controlado: {check.detail}</p>}
      {/* D-071: aunque no se pudo decidir, el dato del archivo le sirve al operador para cotizar. */}
      {check.verdict === "unknown" && check.hint && <p className="file-check hint">{check.hint}</p>}
      <LinkNote check={check} />
    </>
  );
}
