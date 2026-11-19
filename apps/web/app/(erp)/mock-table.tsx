import { Download, Filter, Plus, type LucideIcon } from "lucide-react";
import { Badge, Kpi, PageHead, ars, type Tone } from "./ui";

/** Celda de tabla de ejemplo: texto, número de comprobante, monto o estado. */
export type Cell = string | { mono: string } | { ars: number } | { badge: string; tone: Tone };

export interface MockScreen {
  eyebrow: string;
  title: string;
  sub: string;
  stage: number;
  primary?: string;
  kpis?: { label: string; value: string; foot?: string; icon?: LucideIcon }[];
  tabs?: string[];
  filters?: string[];
  columns: { label: string; num?: boolean }[];
  rows: Cell[][];
  footer?: Cell[];
  note?: string;
}

function renderCell(c: Cell) {
  if (typeof c === "string") return c;
  if ("mono" in c) return <span className="mono">{c.mono}</span>;
  if ("ars" in c) return ars.format(c.ars);
  return <Badge tone={c.tone}>{c.badge}</Badge>;
}

/** Pantalla de listado solo visual (D-032), con la estructura de columnas que se va a construir. */
export function MockTablePage({ screen }: { screen: MockScreen }) {
  return (
    <div className="page">
      <PageHead
        title={screen.title}
        help={
          <>
            {screen.sub}
            {screen.note && <em style={{ display: "block", marginTop: 6 }}>{screen.note}</em>}
          </>
        }
        preview
        stage={screen.stage}
        actions={
          <>
            <button className="btn btn-ghost">
              <Download size={15} /> Exportar
            </button>
            {screen.primary && (
              <button className="btn btn-primary">
                <Plus size={15} /> {screen.primary}
              </button>
            )}
          </>
        }
      />

      {screen.kpis && (
        <div className="kpis">
          {screen.kpis.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </div>
      )}

      <section className="panel">
        {(screen.tabs || screen.filters) && (
          <div className="filters">
            {screen.tabs && (
              <div className="seg">
                {screen.tabs.map((t, i) => (
                  <button key={t} aria-pressed={i === 0}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            {screen.filters?.map((f) => (
              <select key={f} aria-label={f} defaultValue="">
                <option value="">{f}</option>
              </select>
            ))}
            <button className="btn btn-ghost" style={{ marginLeft: "auto" }}>
              <Filter size={14} /> Más filtros
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {screen.columns.map((c) => (
                  <th key={c.label} className={c.num ? "num" : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {screen.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={screen.columns[j]?.num ? "num" : undefined}>
                      {renderCell(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {screen.footer && (
              <tfoot>
                <tr>
                  {screen.footer.map((c, j) => (
                    <td key={j} className={screen.columns[j]?.num ? "num" : undefined}>
                      {renderCell(c)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
