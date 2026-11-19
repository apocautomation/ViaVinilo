"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";
import { clearSession, getToken, getUser, type SessionUser } from "../lib/api";
import { NAV, findNavItem } from "./nav";

const ROLE_LABEL: Record<SessionUser["roles"][number], string> = {
  OWNER: "Dueño",
  PRODUCTION: "Producción",
  ATTENTION: "Atención",
};

function initials(name: string | undefined): string {
  if (!name) return "··";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Estructura del ERP: barra lateral por apartados + encabezado. */
export default function ErpLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  const current = findNavItem(pathname);

  return (
    <div className="erp">
      <aside className="sidebar" aria-label="Menú principal">
        <Link href="/inicio" className="sidebar-brand">
          <img src="/logo-isotipo-blanco.svg" alt="Via Vinilo" />
        </Link>
        <nav className="sidebar-nav">
          {NAV.map((section) => (
            <div key={section.title} className="nav-section">
              <p className="nav-title">{section.title}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = current?.href === item.href;
                return (
                  <Link key={item.href} href={item.href} className="nav-item" aria-current={active ? "page" : undefined}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    <span>{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                    {!item.badge && item.stage && item.stage > 1 && <span className="nav-stage">E{item.stage}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot-live" /> Sistema en línea
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <label className="search">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Buscar orden, cliente o comprobante…" aria-label="Buscar en todo el sistema" />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="header-right">
            <button className="icon-btn" aria-label="Notificaciones">
              <Bell size={18} strokeWidth={1.75} />
              <span className="icon-dot" />
            </button>
            <div className="who-am-i">
              <span className="avatar">{initials(user?.name)}</span>
              <span className="who-text">
                <strong>{user?.name ?? "…"}</strong>
                <small>{user?.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</small>
              </span>
              <ChevronDown size={16} aria-hidden />
            </div>
            <button
              className="icon-btn"
              aria-label="Salir"
              title="Salir"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
