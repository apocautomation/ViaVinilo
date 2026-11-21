"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BellRing, ChevronLeft, ClipboardList, MessageCircle, Plus, UserRound } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL, type Order, type Status } from "./data";
import { enablePush, pushState } from "./push";
import { api } from "./session";

/** Barra inferior: las 4 cosas que hace un cliente (D-034). "Chat" va directo en la barra (D-045). */
export function TabBar() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const check = () =>
      api<{ unread: number }>("/app/chat/unread")
        .then((r) => setUnread(r.unread))
        .catch(() => undefined);
    void check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [path]);
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
      <Link href="/chat" className="tab" aria-current={is("/chat") || is("/ayuda") ? "page" : undefined}>
        <span className="tab-icon">
          <MessageCircle size={22} />
          {unread > 0 && <span className="tab-dot" aria-label={`${unread} mensajes sin leer`} />}
        </span>
        Chat
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

const PUSH_DISMISSED_KEY = "vv.app.push-dismissed";

/** Invita a prender las notificaciones (D-068). Solo aparece si el celular las tiene y todavía no se eligió. */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(PUSH_DISMISSED_KEY) === "1";
    } catch {
      /* sin almacenamiento: se muestra */
    }
    if (dismissed) return;
    void Promise.all([pushState(), api<{ publicKey: string | null }>("/app/push/key").catch(() => ({ publicKey: null }))]).then(([state, key]) =>
      setShow(state === "off" && Boolean(key.publicKey)),
    );
  }, []);
  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
  };
  const turnOn = async () => {
    setBusy(true);
    try {
      await enablePush();
    } catch {
      /* se puede prender después desde Cuenta */
    }
    close();
  };
  return (
    <section className="card push-prompt">
      <span className="list-ico">
        <BellRing size={18} />
      </span>
      <div>
        <strong>Enterate al toque</strong>
        <span>Te avisamos en el celular cuando tu pedido está cotizado o listo, y cuando te respondemos.</span>
        <div className="push-prompt-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => void turnOn()}>
            Prender notificaciones
          </button>
          <button className="btn btn-ghost" onClick={close}>
            Ahora no
          </button>
        </div>
      </div>
    </section>
  );
}
