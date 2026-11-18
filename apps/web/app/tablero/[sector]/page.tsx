"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, clearSession, getToken, getUser, watchBoard, type SessionUser } from "../../lib/api";

type Status =
  | "PENDING_SIGNUP" | "RECEIVED" | "FILE_ERROR" | "QUOTED" | "DEPOSIT_RECEIVED"
  | "PRINTED" | "CALENDERING" | "READY" | "DELIVERED" | "CANCELLED";

interface Card {
  id: string;
  label: string;
  status: Status;
  customer: { id: string; number: number; name: string | null };
  description: string | null;
  measure: string | null;
  quotedAmount: string | null;
  depositRequired: boolean;
  estimatedReadyAt: string | null;
  fileCount: number;
  linkCount: number;
  machine: { id: string; name: string } | null;
  material: { id: string; name: string } | null;
  sameMaterialCount: number;
  createdAt: string;
  next: Status | null;
  other: Status[];
}

interface Board {
  sector: { code: string; name: string };
  machines: { id: string; name: string }[];
  columns: { status: Status; label: string; cards: Card[] }[];
}

interface Sector {
  code: string;
  name: string;
}

interface Reason {
  id: string;
  label: string;
}

/** Texto del botón grande para pasar a cada estado: un clic, sin pensar. */
const NEXT_ACTION: Partial<Record<Status, string>> = {
  RECEIVED: "Archivo corregido",
  QUOTED: "Cotizar",
  DEPOSIT_RECEIVED: "Registrar seña",
  PRINTED: "Marcar impreso",
  CALENDERING: "Pasar a calandra",
  READY: "Marcar terminado",
  DELIVERED: "Entregar",
};

type Dialog =
  | { kind: "quote"; card: Card }
  | { kind: "error"; card: Card }
  | { kind: "cancel"; card: Card }
  | { kind: "force"; card: Card };

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
/** Siempre hora de Salta y en 24 h, sin importar cómo esté configurada la PC del taller. */
const TZ = "America/Argentina/Salta";
const readyAt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fullDate = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, dateStyle: "short", timeStyle: "short", hourCycle: "h23" });

function age(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d`;
}

export default function BoardPage() {
  const router = useRouter();
  const { sector } = useParams<{ sector: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [q, setQ] = useState("");
  const [machineId, setMachineId] = useState("");
  const [groupByMaterial, setGroupByMaterial] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const query = useMemo(() => {
    const p = new URLSearchParams({ sector });
    if (q.trim()) p.set("q", q.trim());
    if (machineId) p.set("machineId", machineId);
    if (groupByMaterial) p.set("groupByMaterial", "true");
    return p.toString();
  }, [sector, q, machineId, groupByMaterial]);

  const load = useCallback(async () => {
    try {
      setBoard(await api<Board>(`/jobs/board?${query}`));
    } catch (e) {
      setToast((e as Error).message);
    }
  }, [query]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    api<Sector[]>("/sectors").then(setSectors).catch(() => undefined);
    api<Reason[]>("/file-error-reasons").then(setReasons).catch(() => undefined);
  }, [router]);

  // Búsqueda con una pequeña espera para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Tiempo real: cuando entra o se mueve una orden en el sector, se recarga.
  useEffect(() => watchBoard(sector, () => void load(), setLive), [sector, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function move(card: Card, body: Record<string, unknown>) {
    setBusy(card.id);
    try {
      await api(`/jobs/${card.id}/transition`, { method: "POST", body: JSON.stringify(body) });
      setDialog(null);
      await load();
    } catch (e) {
      setToast((e as Error).message);
      await load();
    } finally {
      setBusy(null);
    }
  }

  function clickNext(card: Card) {
    if (!card.next) return;
    if (card.next === "QUOTED" && !card.quotedAmount) setDialog({ kind: "quote", card });
    else void move(card, { to: card.next });
  }

  async function assign(card: Card, value: string) {
    setBusy(card.id);
    try {
      await api(`/jobs/${card.id}/machine`, { method: "PATCH", body: JSON.stringify({ machineId: value || null }) });
      await load();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function submitDialog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog) return;
    const f = new FormData(e.currentTarget);
    const { card } = dialog;
    if (dialog.kind === "quote") {
      const eta = String(f.get("eta") || "");
      void move(card, {
        to: "QUOTED",
        quotedAmount: String(f.get("amount") || ""),
        // El operador carga la hora de Salta (UTC-3).
        ...(eta ? { estimatedReadyAt: `${eta}:00-03:00` } : {}),
      });
    } else if (dialog.kind === "error") {
      void move(card, { to: "FILE_ERROR", reasonId: f.get("reason"), note: String(f.get("note") || "") || undefined });
    } else if (dialog.kind === "cancel") {
      void move(card, { to: "CANCELLED", note: String(f.get("note") || "") });
    } else {
      const to = card.next === "DEPOSIT_RECEIVED" ? "PRINTED" : card.next;
      void move(card, { to, force: true, note: String(f.get("note") || "") || undefined });
    }
  }

  const isOwner = user?.roles.includes("OWNER") ?? false;
  const total = board?.columns.reduce((n, c) => n + c.cards.length, 0) ?? 0;

  return (
    <>
      <header className="topbar">
        <img src="/logo-isotipo.svg" alt="Via Vinilo" />
        <nav className="tabs" aria-label="Sectores">
          {sectors.map((s) => (
            <Link key={s.code} href={`/tablero/${s.code}`} className="tab" aria-current={s.code === sector ? "page" : undefined}>
              {s.name}
            </Link>
          ))}
        </nav>
        <div className="user">
          {user?.name}
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            Salir
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por orden (VV-…), cliente o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar"
        />
        <select value={machineId} onChange={(e) => setMachineId(e.target.value)} aria-label="Filtrar por máquina">
          <option value="">Todas las máquinas</option>
          {board?.machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={groupByMaterial} onChange={(e) => setGroupByMaterial(e.target.checked)} />
          Agrupar por material
        </label>
        <span className="live" data-on={live}>
          {live ? `En vivo · ${total} órdenes` : "Reconectando…"}
        </span>
      </div>

      <main className="board">
        {board?.columns.map((col) => (
          <section key={col.status} className="column" data-status={col.status} aria-label={col.label}>
            <h2>
              {col.label} <span>{col.cards.length}</span>
            </h2>
            <div className="cards">
              {col.cards.length === 0 && <p className="empty">Sin órdenes</p>}
              {col.cards.map((card) => (
                <article key={card.id} className="card" aria-busy={busy === card.id}>
                  <header>
                    <span className="num">{card.label}</span>
                    <span className="age" title={fullDate.format(new Date(card.createdAt))}>
                      hace {age(card.createdAt, now)}
                    </span>
                  </header>
                  <div className="who">
                    {card.customer.name ?? "Cliente sin nombre"} · N.º {card.customer.number}
                  </div>
                  {card.description && <div className="desc">{card.description}</div>}
                  <div className="chips">
                    <span className="chip">
                      {card.fileCount} {card.fileCount === 1 ? "archivo" : "archivos"}
                    </span>
                    {card.linkCount > 0 && <span className="chip">{card.linkCount} link</span>}
                    {card.quotedAmount && <span className="chip chip-brand">{money.format(Number(card.quotedAmount))}</span>}
                    {card.depositRequired && card.status !== "DEPOSIT_RECEIVED" && card.next === "DEPOSIT_RECEIVED" && (
                      <span className="chip chip-warn">Requiere seña</span>
                    )}
                    {card.material && <span className="chip">{card.material.name}</span>}
                    {card.sameMaterialCount > 0 && (
                      <span className="chip chip-brand">+{card.sameMaterialCount} con el mismo material</span>
                    )}
                    {card.estimatedReadyAt && (
                      <span className="chip">
                        Listo {readyAt.format(new Date(card.estimatedReadyAt))}
                      </span>
                    )}
                  </div>

                  {card.status !== "DELIVERED" && card.status !== "CANCELLED" && (
                    <select
                      value={card.machine?.id ?? ""}
                      onChange={(e) => void assign(card, e.target.value)}
                      disabled={busy === card.id}
                      aria-label={`Máquina de ${card.label}`}
                    >
                      <option value="">Sin máquina asignada</option>
                      {board.machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {card.next && (
                    <button className="btn btn-primary btn-big" disabled={busy === card.id} onClick={() => clickNext(card)}>
                      {NEXT_ACTION[card.next] ?? "Avanzar"}
                    </button>
                  )}
                  {(card.other.length > 0 || (isOwner && card.next === "DEPOSIT_RECEIVED")) && (
                    <div className="actions">
                      {card.other.includes("FILE_ERROR") && (
                        <button className="btn btn-danger" disabled={busy === card.id} onClick={() => setDialog({ kind: "error", card })}>
                          Error de archivo
                        </button>
                      )}
                      {isOwner && card.next === "DEPOSIT_RECEIVED" && (
                        <button className="btn btn-ghost" disabled={busy === card.id} onClick={() => setDialog({ kind: "force", card })}>
                          Imprimir sin seña
                        </button>
                      )}
                      {card.other.includes("CANCELLED") && (
                        <button className="btn btn-ghost" disabled={busy === card.id} onClick={() => setDialog({ kind: "cancel", card })}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {dialog && (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setDialog(null)}>
          <form className="dialog" onSubmit={submitDialog} role="dialog" aria-modal="true" aria-labelledby="dlg-title">
            {dialog.kind === "quote" && (
              <>
                <h3 id="dlg-title">Cotizar {dialog.card.label}</h3>
                <label className="field">
                  Precio (pesos)
                  <input name="amount" inputMode="decimal" placeholder="Ej.: 18500,50" required autoFocus />
                </label>
                <label className="field">
                  Listo para retirar (opcional)
                  <input name="eta" type="datetime-local" />
                </label>
              </>
            )}
            {dialog.kind === "error" && (
              <>
                <h3 id="dlg-title">Error de archivo en {dialog.card.label}</h3>
                <label className="field">
                  Motivo
                  <select name="reason" required defaultValue="">
                    <option value="" disabled>
                      Elegí el motivo
                    </option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Detalle para el cliente (opcional)
                  <textarea name="note" rows={2} maxLength={500} />
                </label>
              </>
            )}
            {dialog.kind === "cancel" && (
              <>
                <h3 id="dlg-title">Cancelar {dialog.card.label}</h3>
                <label className="field">
                  Motivo
                  <textarea name="note" rows={2} maxLength={500} required autoFocus />
                </label>
              </>
            )}
            {dialog.kind === "force" && (
              <>
                <h3 id="dlg-title">Imprimir {dialog.card.label} sin seña</h3>
                <p style={{ margin: 0, fontSize: 14 }}>Queda registrado que lo autorizaste vos.</p>
                <label className="field">
                  Motivo (opcional)
                  <textarea name="note" rows={2} maxLength={500} />
                </label>
              </>
            )}
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
                Volver
              </button>
              <button className="btn btn-primary" disabled={busy === dialog.card.id}>
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
