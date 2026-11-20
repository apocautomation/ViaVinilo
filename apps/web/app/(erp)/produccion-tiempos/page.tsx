"use client";

import { Timer } from "lucide-react";
import { PageHead } from "../ui";

/**
 * Panel de tiempos (E1): cuánto tarda cada paso por sector y máquina. Se calcula con los
 * cambios de estado reales (JobEvent); sin datos de ejemplo (D-045).
 * TODO(spec): D-044 punto 7 — calcular los tiempos desde JobEvent cuando haya pedidos reales.
 */
export default function TiemposPage() {
  return (
    <div className="page">
      <PageHead
        title="Panel de tiempos"
        help="Cuánto tarda cada paso por sector y máquina, para ver dónde se traban los trabajos. Se calcula con los cambios de estado reales del tablero."
      />
      <section className="panel">
        <div className="empty" style={{ padding: 48, gap: 10 }}>
          <Timer size={32} aria-hidden />
          <strong style={{ color: "var(--color-text)", fontSize: 15 }}>Todavía no hay tiempos para mostrar</strong>
          <span>Cuando los pedidos empiecen a moverse por el tablero, acá vas a ver cuánto tarda cada paso.</span>
        </div>
      </section>
    </div>
  );
}
