import type { FileCheckSummary, JobStatus } from "@viavinilo/contracts";
import { nextActionLabel, type PanelMode } from "./board-rules";

/** El botón grande que pasa el pedido al paso siguiente. */
export function NextButton({
  next,
  disabled,
  size,
  onClick,
}: {
  next: JobStatus | null;
  disabled: boolean;
  size: "sm" | "big";
  onClick: () => void;
}) {
  if (!next) return null;
  return (
    <button className={`btn btn-primary btn-${size}`} disabled={disabled} onClick={onClick}>
      {nextActionLabel(next)}
    </button>
  );
}

/** Error de archivo, imprimir sin seña (solo el dueño) y cancelar: lo mismo en la tarjeta y en el panel. */
export function SideActions({
  next,
  other,
  isOwner,
  disabled,
  onPick,
}: {
  next: JobStatus | null;
  other: readonly JobStatus[];
  isOwner: boolean;
  disabled: boolean;
  onPick: (mode: PanelMode) => void;
}) {
  const canForce = isOwner && next === "DEPOSIT_RECEIVED";
  return (
    <>
      {other.includes("FILE_ERROR") && (
        <button className="btn btn-danger" disabled={disabled} onClick={() => onPick("error")}>
          Error de archivo
        </button>
      )}
      {canForce && (
        <button className="btn btn-ghost" disabled={disabled} onClick={() => onPick("force")}>
          Imprimir sin seña
        </button>
      )}
      {other.includes("CANCELLED") && (
        <button className="btn btn-ghost" disabled={disabled} onClick={() => onPick("cancel")}>
          Cancelar
        </button>
      )}
    </>
  );
}

/** D-077: un link que no se pudo bajar se avisa siempre, haya o no otro archivo en el pedido. */
export function LinkNote({ check }: { check: FileCheckSummary | null }) {
  if (!check?.linkNote) return null;
  return (
    <p className="file-check review" title={check.linkNote}>
      <b>Link sin bajar:</b> {check.linkNote}
    </p>
  );
}
