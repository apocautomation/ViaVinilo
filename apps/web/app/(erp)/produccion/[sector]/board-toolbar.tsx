import type { Board } from "@viavinilo/contracts";
import type { BoardFilterState } from "./use-board";

/** Una lista de filtro que solo aparece si el tablero tiene opciones para elegir. */
function FilterSelect({
  value,
  onChange,
  label,
  all,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  all: string;
  options: { value: string; text: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.text}
        </option>
      ))}
    </select>
  );
}

export function BoardToolbar({
  board,
  filters: f,
  compact,
  onCompact,
}: {
  board: Board | null;
  filters: BoardFilterState;
  compact: boolean;
  onCompact: (value: boolean) => void;
}) {
  const services = board?.services.map((s) => ({ value: s.code, text: s.name })) ?? [];
  const variants = board?.variants.map((v) => ({ value: v.code, text: `${v.code} · ${v.name}` })) ?? [];
  const machines = board?.machines.map((m) => ({ value: m.id, text: m.name })) ?? [];
  return (
    <div className="toolbar">
      <input
        type="search"
        placeholder="Buscar por orden (VV-…), cliente o email"
        value={f.q}
        onChange={(e) => f.setQ(e.target.value)}
        aria-label="Buscar"
      />
      {services.length > 0 && (
        <FilterSelect
          value={f.service}
          onChange={f.setService}
          label="Filtrar por servicio"
          all="Todos los servicios"
          options={services}
        />
      )}
      {variants.length > 0 && (
        <FilterSelect
          value={f.variant}
          onChange={f.setVariant}
          label="Filtrar por opción de impresión"
          all="Todas las opciones"
          options={variants}
        />
      )}
      <FilterSelect
        value={f.machineId}
        onChange={f.setMachineId}
        label="Filtrar por máquina"
        all="Todas las máquinas"
        options={machines}
      />
      <label className="toggle">
        <input
          type="checkbox"
          checked={f.groupByMaterial}
          onChange={(e) => f.setGroupByMaterial(e.target.checked)}
        />
        Agrupar por opción
      </label>
      <label className="toggle">
        <input type="checkbox" checked={compact} onChange={(e) => onCompact(e.target.checked)} />
        Vista compacta
      </label>
    </div>
  );
}
