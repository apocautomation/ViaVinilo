import type { ReactNode } from "react";
import { TabBar } from "../components";
import { SessionGate } from "../session";

/**
 * Pantallas con sesión iniciada. En el celular: columna + barra inferior. En escritorio: menú a la
 * izquierda y contenido ancho (globals.css, "Escritorio"). Sin sesión, a /ingresar.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell app-shell">
      <SessionGate>
        {children}
        <TabBar />
      </SessionGate>
    </div>
  );
}
