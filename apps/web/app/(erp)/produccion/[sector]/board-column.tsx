import { FileText } from "lucide-react";
import type { BoardCard, BoardColumn, JobStatus } from "@viavinilo/contracts";
import { dropVerdict } from "./board-rules";
import { CardView, type CardContext } from "./board-card";
import { groupByMaterial, type MaterialGroup } from "./material-groups";

/** Color de cada columna (punto del encabezado y borde de la tarjeta). */
const STATUS_COLOR: Partial<Record<JobStatus, string>> = {
  PENDING_SIGNUP: "var(--color-neutral-400)",
  RECEIVED: "var(--color-brand-500)",
  FILE_ERROR: "var(--color-danger)",
  QUOTED: "var(--color-accent-500)",
  DEPOSIT_RECEIVED: "var(--color-warning-500)",
  PRINTED: "var(--color-navy-500)",
  CALENDERING: "var(--color-navy-400)",
  READY: "var(--color-success-500)",
  DELIVERED: "var(--color-success-700)",
};

const columnColor = (col: BoardColumn) =>
  col.key === "AWAITING_DEPOSIT" ? "var(--color-warning)" : STATUS_COLOR[col.status];

export interface ColumnProps {
  col: BoardColumn;
  /** Número de paso en la secuencia, o -1 si la columna no es un paso (error, alta, esperando seña). */
  step: number;
  compact: boolean;
  grouped: boolean;
  isOwner: boolean;
  dragging: BoardCard | null;
  over: boolean;
  onDragOver: () => void;
  onDrop: () => void;
  /** Lo que cada tarjeta necesita del tablero. */
  cardContext: (card: BoardCard) => CardContext;
}

function GroupHead({ group }: { group: MaterialGroup<BoardCard> }) {
  const n = group.cards.length;
  return (
    <div className="mat-group-head">
      <span className="mat-swatch" aria-hidden />
      {group.code && <b>{group.code}</b>}
      <span className="mat-title">{group.title}</span>
      <span className="mat-count" aria-label={`${n} ${n === 1 ? "trabajo" : "trabajos"}`}>
        {n}
      </span>
    </div>
  );
}

function GroupView({
  group,
  grouped,
  compact,
  cardContext,
}: {
  group: MaterialGroup<BoardCard>;
  grouped: boolean;
  compact: boolean;
  cardContext: (card: BoardCard) => CardContext;
}) {
  return (
    <div
      className={grouped ? "mat-group" : "mat-all"}
      data-none={grouped && !group.color ? "true" : undefined}
      style={group.color ? { ["--mat" as string]: group.color } : undefined}
    >
      {grouped && <GroupHead group={group} />}
      {group.cards.map((card) => (
        <CardView key={card.id} card={card} compact={compact} ctx={cardContext(card)} />
      ))}
    </div>
  );
}

export function Column({
  col,
  step,
  compact,
  grouped,
  isOwner,
  dragging,
  over,
  onDragOver,
  onDrop,
  cardContext,
}: ColumnProps) {
  const groups: MaterialGroup<BoardCard>[] = grouped
    ? groupByMaterial(col.cards)
    : [{ key: "all", code: null, title: "", color: null, cards: col.cards }];
  return (
    <section
      className="column"
      data-drop={dragging && over ? dropVerdict(dragging, col.status, isOwner) : undefined}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      aria-label={col.label}
      style={{ ["--col" as string]: columnColor(col) }}
    >
      <div className="column-head">
        <span className="column-dot" />
        <h2>{col.label}</h2>
        {step >= 0 && <span className="column-step">Paso {step + 1}</span>}
        <span className="column-count">{col.cards.length}</span>
      </div>
      <div className="cards">
        {col.cards.length === 0 && (
          <div className="empty">
            <FileText size={18} aria-hidden />
            Sin órdenes
          </div>
        )}
        {/* D-110: con "Agrupar por opción", los trabajos de la misma tela van uno abajo del otro bajo su color. */}
        {groups.map((group) => (
          <GroupView
            key={group.key}
            group={group}
            grouped={grouped}
            compact={compact}
            cardContext={cardContext}
          />
        ))}
      </div>
    </section>
  );
}
