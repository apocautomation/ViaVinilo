import type { InputHTMLAttributes, ReactNode } from "react";
import { maskAmount } from "@viavinilo/contracts";
import { Eye, Search, type LucideIcon } from "lucide-react";
import { Help } from "./help";

/**
 * Encabezado de página: solo el título. La explicación va en el "?" (`help`).
 * `preview` marca las pantallas que por ahora son solo visuales (D-032).
 */
export function PageHead({
  title,
  help,
  preview,
  stage,
  actions,
}: {
  title: string;
  help?: ReactNode;
  preview?: boolean;
  stage?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <h1>
        {title}
        {help && <Help label={`Qué es ${title}`}>{help}</Help>}
        {preview && (
          <span className="preview-pill" title="Pantalla de muestra con datos de ejemplo">
            <Eye size={12} aria-hidden /> Vista previa{stage ? ` · Etapa ${stage}` : ""}
          </span>
        )}
      </h1>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  foot,
  icon: Icon,
}: {
  label: string;
  value: string;
  foot?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="panel kpi">
      <span className="kpi-label">
        {label}
        {Icon && <Icon size={16} aria-hidden />}
      </span>
      <span className="kpi-value">{value}</span>
      {foot && <span className="kpi-foot">{foot}</span>}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge${tone === "neutral" ? "" : ` badge-${tone}`}`}>{children}</span>;
}

/**
 * Campo de monto en pesos (D-055): se escribe con puntos de miles y coma decimal ("18.500,50").
 * Sirve igual en formularios no controlados: corrige el valor mientras se tipea.
 */
export function MoneyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">) {
  return (
    <input
      {...props}
      inputMode="decimal"
      autoComplete="off"
      onInput={(e) => {
        e.currentTarget.value = maskAmount(e.currentTarget.value);
        props.onInput?.(e);
      }}
    />
  );
}

/** Montos en pesos argentinos, siempre con 2 decimales. */
export const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

/** Iniciales para el avatar: "Ana María Pérez" → "AM". Sin nombre, `empty`. */
export function initials(name: string | null | undefined, empty = "?"): string {
  if (!name) return empty;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Aviso en lugar de un listado: cargando, vacío o sin permiso. */
export function EmptyState({ padding = 32, children }: { padding?: number; children: ReactNode }) {
  return (
    <div className="empty" style={{ padding }}>
      {children}
    </div>
  );
}

export function Loading({ padding }: { padding?: number }) {
  return <EmptyState padding={padding}>Cargando…</EmptyState>;
}

/** Una fila que ocupa toda la tabla con un aviso (cargando o vacío). */
export function TableMessage({ colSpan, padding, children }: { colSpan: number; padding?: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState padding={padding}>{children}</EmptyState>
      </td>
    </tr>
  );
}

/** Pie de una tabla paginada: el total y los botones Anterior / Siguiente. */
export function TableFoot({
  total,
  noun,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  /** Singular y plural: ["cliente", "clientes"]. */
  noun: [string, string];
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="table-foot">
      <span>
        {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <div className="pager">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <span>
          {page} de {pages}
        </span>
        <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}

/** Buscador de los listados. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  pushRight,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  /** Lo manda al final de la barra de filtros. */
  pushRight?: boolean;
}) {
  return (
    <label className="search" style={pushRight ? { marginLeft: "auto" } : undefined}>
      <Search size={16} aria-hidden />
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} autoFocus={autoFocus} />
    </label>
  );
}

/**
 * Lo que ve quien entra a una pantalla del dueño: "Cargando…" mientras se lee el rol (`isOwner` en
 * null, ver `useIsOwner`) y `denied` si no es el dueño.
 */
export function OwnerGate({ isOwner, title, denied, className = "page" }: { isOwner: false | null; title: string; denied: string; className?: string }) {
  return (
    <div className={className}>
      <PageHead title={title} />
      {isOwner === null ? <Loading /> : <EmptyState>{denied}</EmptyState>}
    </div>
  );
}
