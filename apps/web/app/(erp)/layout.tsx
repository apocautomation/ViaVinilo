"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, Factory, LogOut, Search, Settings } from "lucide-react";
import { USER_ROLE_LABELS } from "@viavinilo/contracts";
import { api, clearSession, getToken, getUser, type SessionUser } from "../lib/api";
import { NAV, findNavItem, type NavItem, type NavSection } from "./nav";
import { initials } from "./ui";

function MenuLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="menu-item" aria-current={active ? "page" : undefined} role="menuitem">
      <Icon size={17} strokeWidth={1.75} aria-hidden />
      <span>{item.label}</span>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
      {!item.badge && item.stage && item.stage > 1 && <span className="nav-stage">E{item.stage}</span>}
    </Link>
  );
}

/** Apartado del menú superior que se despliega con un clic (D-033). */
function Dropdown({
  section,
  open,
  anyOpen,
  onToggle,
  active,
  current,
  extra,
}: {
  section: NavSection;
  open: boolean;
  /** Si ya hay un menú abierto, pasar el mouse por otro apartado lo abre (como en un menú de escritorio). */
  anyOpen: boolean;
  onToggle: (open: boolean) => void;
  active: boolean;
  current: NavItem | undefined;
  extra?: ReactNode;
}) {
  const wide = section.items.length > 5;
  const hoverOpenedAt = useRef(0);
  return (
    <div
      className="dd"
      onMouseEnter={() => {
        if (anyOpen && !open) {
          hoverOpenedAt.current = Date.now();
          onToggle(true);
        }
      }}
    >
      <button
        className="top-link"
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={active}
        // Si se acaba de abrir al pasar el mouse, el clic no lo vuelve a cerrar.
        onClick={() => (open && Date.now() - hoverOpenedAt.current < 400 ? undefined : onToggle(!open))}
      >
        {section.title}
        <ChevronDown size={15} className="dd-chevron" aria-hidden />
      </button>
      {open && (
        <div className={`dd-panel${wide ? " dd-wide" : ""}`} role="menu" aria-label={section.title}>
          {extra}
          {section.items.map((item) => (
            <MenuLink key={item.href} item={item} active={current?.href === item.href} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Notice {
  kind: string;
  level: "urgent" | "normal";
  title: string;
  detail: string;
  href: string;
  count: number;
}

/** Campanita (D-067): avisos reales, calculados por la API. El punto rojo aparece solo si hay algo. */
function NoticeBell({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const [data, setData] = useState<{ total: number; items: Notice[] }>({ total: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      if (document.visibilityState === "visible" && getToken()) api<{ total: number; items: Notice[] }>("/notifications").then(setData).catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = data.total > 0 ? `Avisos: ${data.total} ${data.total === 1 ? "pendiente" : "pendientes"}` : "Avisos: nada pendiente";
  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" aria-label={label} title="Avisos" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={18} strokeWidth={1.75} />
        {data.total > 0 && <span className="icon-dot" />}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <strong>Avisos</strong>
            {isOwner && <Link href="/configuracion?tab=avisos">Cambiar los tiempos</Link>}
          </div>
          {data.items.map((n) => (
            <Link key={n.kind} href={n.href} className="bell-item" data-level={n.level}>
              <strong>{n.title}</strong>
              <small>{n.detail}</small>
            </Link>
          ))}
          {data.items.length === 0 && <div className="bell-empty">No hay nada pendiente.</div>}
        </div>
      )}
    </div>
  );
}

/** Estructura del ERP: barra superior con un menú desplegable por apartado (D-033). */
export default function ErpLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sectors, setSectors] = useState<{ code: string; name: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  /** "Tableros por sector" es un desplegable dentro del menú Producción (D-064). */
  const [boardsToggle, setBoardsToggle] = useState<boolean | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    const loadSectors = () => api<{ code: string; name: string }[]>("/sectors").then(setSectors).catch(() => undefined);
    void loadSectors();
    // "Administrar tableros" avisa cuando cambia la lista, así el menú se actualiza sin recargar (D-064).
    window.addEventListener("vv:sectors", loadSectors);
    return () => window.removeEventListener("vv:sectors", loadSectors);
  }, [router]);

  // Al navegar se cierra el menú.
  useEffect(() => {
    setOpen(null);
    setBoardsToggle(null);
  }, [pathname]);

  // Clic afuera o Escape cierran el menú.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const current = findNavItem(pathname);
  const sectionOf = (s: NavSection) =>
    s.items.some((i) => i.href === current?.href) || (s.title === "Producción" && pathname.startsWith("/produccion"));
  // Arranca cerrado, salvo que ya estés parado en un tablero.
  const boardsOpen = boardsToggle ?? sectors.some((s) => pathname === `/produccion/${s.code}`);

  return (
    <div className="erp">
      <header className="topbar">
        <Link href="/inicio" className="topbar-brand" aria-label="Inicio">
          <img src="/logo-isotipo.svg" alt="Via Vinilo" />
        </Link>

        <nav className="topnav" aria-label="Menú principal" ref={navRef}>
          {NAV.map((section) => {
            if (section.title === "Sistema") return null;
            if (section.items.length === 1) {
              const item = section.items[0]!;
              return (
                <Link key={item.href} href={item.href} className="top-link" data-active={current?.href === item.href}>
                  {item.label}
                </Link>
              );
            }
            return (
              <Dropdown
                key={section.title}
                section={section}
                open={open === section.title}
                anyOpen={open !== null}
                onToggle={(o) => setOpen(o ? section.title : null)}
                active={sectionOf(section)}
                current={current}
                extra={
                  section.title === "Producción" && sectors.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="menu-item menu-group"
                        aria-expanded={boardsOpen}
                        onClick={() => setBoardsToggle(!boardsOpen)}
                      >
                        <Factory size={17} strokeWidth={1.75} aria-hidden />
                        <span>Tableros por sector</span>
                        <ChevronDown size={15} className="menu-group-chevron" aria-hidden />
                      </button>
                      {boardsOpen &&
                        sectors.map((s) => (
                          <Link
                            key={s.code}
                            href={`/produccion/${s.code}`}
                            className="menu-item menu-sub"
                            role="menuitem"
                            aria-current={pathname === `/produccion/${s.code}` ? "page" : undefined}
                          >
                            <span>{s.name}</span>
                          </Link>
                        ))}
                      <hr className="dd-sep" />
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </nav>

        <div className="header-right">
          <label className="search search-compact">
            <Search size={16} aria-hidden />
            <input type="search" placeholder="Buscar…" aria-label="Buscar orden, cliente o comprobante" />
          </label>
          <NoticeBell isOwner={user?.roles.includes("OWNER") ?? false} />
          <Link href="/configuracion" className="icon-btn" aria-label="Configuración" title="Configuración">
            <Settings size={18} strokeWidth={1.75} />
          </Link>
          <div className="who-am-i" title={user?.roles.map((r) => USER_ROLE_LABELS[r]).join(" · ")}>
            <span className="avatar">{initials(user?.name, "··")}</span>
            <span className="who-text">
              <strong>{user?.name ?? "…"}</strong>
              <small>{user?.roles.map((r) => USER_ROLE_LABELS[r]).join(" · ")}</small>
            </span>
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
  );
}
