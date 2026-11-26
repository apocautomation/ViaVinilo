"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { BoardCard, JobStatus, MachineRef, SectorRef } from "@viavinilo/contracts";
import { Help } from "../../help";
import { dropIntent, flowOf } from "./board-rules";
import { Column } from "./board-column";
import { BoardToolbar } from "./board-toolbar";
import type { CardContext } from "./board-card";
import { OrderPanel } from "./order-panel";
import { useBoard, type BoardState } from "./use-board";

function BoardHeader({ name, live, total }: { name: string | undefined; live: boolean; total: number }) {
  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <div className="page-head">
        <h1>
          Tablero · {name ?? "…"}
          <Help label="Cómo funciona el tablero">
            <strong>Pasos obligatorios:</strong> cada trabajo avanza de a un paso y no se puede saltear
            ninguno.
            <br />
            Para avanzar un pedido, tocá su botón o arrastrá la tarjeta a la columna siguiente. El archivo se
            puede descargar en cualquier paso.
            <br />
            El cliente ve cada cambio en su app al instante. En amarillo: más de 2 h en el mismo paso.
          </Help>
        </h1>
        <span className="live" data-on={live}>
          {live ? `En vivo · ${total} órdenes` : "Reconectando…"}
        </span>
      </div>
    </div>
  );
}

function SectorTabs({ sectors, current }: { sectors: readonly SectorRef[]; current: string }) {
  return (
    <div className="board-top">
      <nav className="sector-tabs" aria-label="Sectores">
        {sectors.map((s) => (
          <Link
            key={s.code}
            href={`/produccion/${s.code}`}
            className="sector-tab"
            aria-current={s.code === current ? "page" : undefined}
          >
            {s.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** D-086: arrastrar una tarjeta a la columna siguiente la hace avanzar. */
function useCardDrag() {
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const stop = () => {
    setDragging(null);
    setOver(null);
  };
  return { dragging, over, setOver, start: setDragging, stop };
}

type CardDrag = ReturnType<typeof useCardDrag>;

function cardContextFor(b: BoardState, drag: CardDrag, flow: JobStatus[], machines: readonly MachineRef[]) {
  return (card: BoardCard): CardContext => ({
    now: b.now,
    busy: b.busy === card.id,
    dragging: drag.dragging?.id === card.id,
    isOwner: b.isOwner,
    flow,
    machines,
    grouped: b.filters.groupByMaterial,
    onIntent: (intent) => b.apply(card, intent),
    onAssign: (machineId) => void b.assign(card, machineId),
    onDownload: () => void b.downloadForPrint(card.id),
    onDragStart: () => drag.start(card),
    onDragEnd: drag.stop,
  });
}

function PanelHost({ b, machines }: { b: BoardState; machines: readonly MachineRef[] }) {
  if (!b.panel) return null;
  return (
    <OrderPanel
      key={`${b.panel.id}-${b.panel.mode}`}
      jobId={b.panel.id}
      initialMode={b.panel.mode}
      machines={machines}
      reasons={b.reasons}
      isOwner={b.isOwner}
      onClose={() => b.setPanel(null)}
      onChanged={() => void b.load()}
    />
  );
}

export default function BoardPage() {
  const { sector } = useParams<{ sector: string }>();
  const b = useBoard(sector);
  const drag = useCardDrag();
  const { dragging } = drag;

  const columns = b.board?.columns ?? [];
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  const flow = flowOf(columns);
  const grouped = b.filters.groupByMaterial;
  const machines = b.board?.machines ?? [];
  const cardContext = cardContextFor(b, drag, flow, machines);

  return (
    <>
      <BoardHeader name={b.board?.sector.name} live={b.live} total={total} />
      <SectorTabs sectors={b.sectors} current={sector} />

      <BoardToolbar board={b.board} filters={b.filters} compact={b.compact} onCompact={b.setCompact} />

      <main className="board">
        {columns.map((col) => (
          <Column
            key={col.key}
            col={col}
            step={col.key === col.status ? flow.indexOf(col.status) : -1}
            compact={b.compact}
            grouped={grouped}
            isOwner={b.isOwner}
            dragging={dragging}
            over={drag.over === col.key}
            onDragOver={() => drag.setOver(col.key)}
            onDrop={() => {
              drag.stop();
              if (dragging) b.apply(dragging, dropIntent(dragging, col.status, b.isOwner));
            }}
            cardContext={cardContext}
          />
        ))}
      </main>

      <PanelHost b={b} machines={machines} />

      {b.toast && (
        <div className="toast" role="status">
          {b.toast}
        </div>
      )}
    </>
  );
}
