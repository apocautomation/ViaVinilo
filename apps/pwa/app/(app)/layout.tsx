import type { ReactNode } from "react";
import { TabBar } from "../components";

/** Pantallas con sesión iniciada: columna de celular + barra inferior. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      {children}
      <TabBar />
    </div>
  );
}
