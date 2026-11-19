import type { ReactNode } from "react";
import { TabBar } from "../components";
import { SessionGate } from "../session";

/** Pantallas con sesión iniciada: columna de celular + barra inferior. Sin sesión, a /ingresar. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <SessionGate>
        {children}
        <TabBar />
      </SessionGate>
    </div>
  );
}
