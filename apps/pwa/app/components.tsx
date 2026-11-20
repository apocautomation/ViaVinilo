"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, ChevronLeft, CircleHelp, ClipboardList, Plus, UserRound } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL, type Order, type Status } from "./data";

/** Barra inferior: las 4 cosas que hace un cliente (D-034). */
export function TabBar() {
  const path = usePathname();
  const is = (p: string) => (p === "/" ? path === "/" || path.startsWith("/pedidos") : path.startsWith(p));
  return (
    <nav className="tabbar" aria-label="Menú">
      {/* Solo en escritorio, arriba del menú lateral. */}
      <Link href="/" className="tabbar-brand" aria-label="Via Vinilo, inicio">
        <img src="/logo-mascota.svg" alt="Via Vinilo" />
      </Link>
      <Link href="/" className="tab" aria-current={is("/") ? "page" : undefined}>
        <ClipboardList size={22} />
        Pedidos
      </Link>
      <Link href="/enviar" className="tab" aria-current={is("/enviar") ? "page" : undefined}>
        <span className="tab-send">
          <Plus size={20} strokeWidth={2.5} />
        </span>
        Enviar
      </Link>
      <Link href="/ayuda" className="tab" aria-current={is("/ayuda") ? "page" : undefined}>
        <CircleHelp size={22} />
        Ayuda
      </Link>
      <Link href="/cuenta" className="tab" aria-current={is("/cuenta") ? "page" : undefined}>
        <UserRound size={22} />
        Cuenta
      </Link>
    </nav>
  );
}

/** Encabezado de cada pantalla. Sin título muestra el logo (pantalla principal). */
export function AppBar({ title, back, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="appbar">
      {back && (
        <button className="icon-btn" aria-label="Volver" onClick={() => router.back()}>
          <ChevronLeft size={24} />
        </button>
      )}
      {title ? <h1>{title}</h1> : <img className="appbar-logo" src="/logo-mascota.svg" alt="Via Vinilo" />}
      {!title && <span className="appbar-spacer" />}
      {right ?? (
        <Link href="/avisos" className="icon-btn" aria-label="Avisos">
          <Bell size={22} />
          <span className="dot" />
        </Link>
      )}
    </header>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return <span className={`status ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** Barra de avance: cuántos pasos de la secuencia del sector ya pasaron. */
export function StepsBar({ order }: { order: Order }) {
  const error = order.status === "FILE_ERROR";
  const pos = error ? 0 : order.steps.indexOf(order.status);
  return (
    <div className="bar" aria-label={`Paso ${pos + 1} de ${order.steps.length}`}>
      {order.steps.map((s, i) => (
        <span key={s} data-done={!error && i <= pos} data-error={error && i === 0} />
      ))}
    </div>
  );
}
