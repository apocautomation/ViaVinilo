import type { ReactNode } from "react";
import { Eye, type LucideIcon } from "lucide-react";
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

/** Montos en pesos argentinos, siempre con 2 decimales. */
export const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
