import Link from "next/link";
import { Bot, ClipboardList, Factory, PackageCheck, Receipt } from "lucide-react";
import { Badge, Kpi, PageHead, ars } from "../ui";

// Datos de ejemplo (D-032). Se reemplazan por la API a medida que se construye cada etapa.
const SECTORS = [
  { name: "DTF", received: 14, quoted: 6, printing: 9, ready: 11 },
  { name: "DTF UV", received: 4, quoted: 2, printing: 3, ready: 5 },
  { name: "Gran Formato", received: 7, quoted: 3, printing: 4, ready: 6 },
  { name: "Látex", received: 3, quoted: 1, printing: 2, ready: 2 },
  { name: "Sublimación", received: 5, quoted: 4, printing: 3, ready: 4 },
  { name: "Calandrado", received: 0, quoted: 0, printing: 4, ready: 3 },
];

const CHATS = [
  { who: "Remeras del Norte", msg: "¿Ya está impreso el VV-000418?", when: "hace 2 min", by: "IA" },
  { who: "Estampados Güemes", msg: "Te mando el archivo corregido", when: "hace 9 min", by: "Asesor" },
  { who: "Gráfica Lerma", msg: "¿Cuánto sale 3 m de vinilo mate?", when: "hace 14 min", by: "IA" },
  { who: "Sublimarte", msg: "Paso a buscar a las 18", when: "hace 31 min", by: "IA" },
];

const LATE = [
  { num: "VV-000402", who: "Gráfica Lerma", step: "Cotizado", time: "5 h 20 min", sector: "Gran Formato" },
  { num: "VV-000409", who: "Remeras del Norte", step: "Archivo recibido", time: "3 h 05 min", sector: "DTF" },
  { num: "VV-000411", who: "Sublimarte", step: "Seña recibida", time: "2 h 40 min", sector: "Sublimación" },
];

export default function InicioPage() {
  const max = Math.max(...SECTORS.map((s) => s.received + s.quoted + s.printing + s.ready));
  return (
    <div className="page">
      <PageHead
        title="Inicio"
        help="Resumen del día: pedidos, producción por sector, conversaciones de la app y trabajos que llevan más de 2 h en el mismo paso."
        preview
      />

      <div className="kpis">
        <Kpi label="Pedidos de hoy" value="38" icon={ClipboardList} foot={<><span className="up">+12%</span> vs. jueves pasado</>} />
        <Kpi label="En producción" value="61" icon={Factory} foot="en 6 sectores" />
        <Kpi label="Listos para retirar" value="31" icon={PackageCheck} foot="avisados por la app" />
        <Kpi label="Consultas resueltas por la IA" value="84%" icon={Bot} foot="112 de 133 mensajes hoy" />
        <Kpi label="Facturado en noviembre" value={ars.format(18452300)} icon={Receipt} foot={<><span className="up">+8%</span> vs. octubre</>} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Producción por sector</h2>
            <div className="chips">
              <span className="chip"><i style={dot("var(--color-brand-500)")} /> Recibido</span>
              <span className="chip"><i style={dot("var(--color-accent-500)")} /> Cotizado</span>
              <span className="chip"><i style={dot("var(--color-navy-500)")} /> Imprimiendo</span>
              <span className="chip"><i style={dot("var(--color-success-500)")} /> Listo</span>
            </div>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: 14 }}>
            {SECTORS.map((s) => {
              const total = s.received + s.quoted + s.printing + s.ready;
              return (
                <div key={s.name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 12, alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{s.name}</strong>
                  <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--color-neutral-100)", width: `${(total / max) * 100}%`, minWidth: 8 }}>
                    <span style={{ flex: s.received, background: "var(--color-brand-500)" }} />
                    <span style={{ flex: s.quoted, background: "var(--color-accent-500)" }} />
                    <span style={{ flex: s.printing, background: "var(--color-navy-500)" }} />
                    <span style={{ flex: s.ready, background: "var(--color-success-500)" }} />
                  </div>
                  <span className="mono" style={{ textAlign: "right", color: "var(--color-text)" }}>{total}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Conversaciones de la app</h2>
            <Link href="/ventas/conversaciones" style={{ fontSize: 12.5, fontWeight: 600 }}>Ver todas</Link>
          </div>
          <div>
            {CHATS.map((c) => (
              <div key={c.who} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--color-neutral-100)" }}>
                <span className="avatar avatar-sm">{c.who.split(" ").filter((p) => p.length > 3).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("")}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{c.who}</strong>
                    <small style={{ color: "var(--color-text-muted)" }}>{c.when}</small>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                    <span className={`mini-tag ${c.by === "IA" ? "tag-ai" : "tag-human"}`}>{c.by}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.msg}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Trabajos demorados</h2>
          <Badge tone="warn">3 superan las 2 h en el mismo paso</Badge>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Sector</th>
                <th>Paso actual</th>
                <th className="num">Tiempo en el paso</th>
              </tr>
            </thead>
            <tbody>
              {LATE.map((l) => (
                <tr key={l.num}>
                  <td className="mono">{l.num}</td>
                  <td>{l.who}</td>
                  <td>{l.sector}</td>
                  <td><Badge tone="info">{l.step}</Badge></td>
                  <td className="num"><Badge tone="warn">{l.time}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function dot(color: string) {
  return { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color } as const;
}
