"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Clock, Download, FileText, Lock, Paperclip } from "lucide-react";
import { api, downloadFile, getUser, watchBoard, type SessionUser } from "../../../lib/api";
import { Help } from "../../help";
import { ars, MoneyInput } from "../../ui";

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
  /** Resultado del control automático del archivo (D-065). */
  fileCheck: { verdict: "ok" | "review" | "error" | "unknown"; detail: string } | null;
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

/** Color de cada columna (punto del encabezado y borde de la tarjeta). */
const STATUS_COLOR: Partial<Record<Status, string>> = {
  PENDING_SIGNUP: "var(--color-neutral-400)",
  RECEIVED: "var(--color-brand-500)",
  FILE_ERROR: "var(--color-danger)",
  QUOTED: "var(--color-accent-500)",
  DEPOSIT_RECEIVED: "var(--color-warning-500)",
  PRINTED: "var(--color-navy-500)",
  CALENDERING: "var(--color-navy-400)",
  READY: "var(--color-success-500)",
  DELIVERED: "var(--color-success-700)",
};

/**
 * Propuesta D-032 / I-17: el archivo de impresión se descarga desde la tarjeta y solo se libera cuando la
 * orden está lista para imprimir. Así el operador tiene que mover la tarjeta para poder trabajar.
 * TODO(spec): I-17 — falta confirmarlo con el cliente y conectar la descarga real de JobFile.
 */
function printUnlocked(card: Card): boolean {
  return card.next === "PRINTED";
}

/** Más de 2 h en el mismo paso: se marca en amarillo. TODO(spec): I-11 — umbral por sector. */
const LATE_MIN = 120;

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const money = ars;
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

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export default function BoardPage() {
  const { sector } = useParams<{ sector: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [q, setQ] = useState("");
  const [machineId, setMachineId] = useState("");
  const [groupByMaterial, setGroupByMaterial] = useState(false);
  /**
   * Vista compacta (D-066): cada tarjeta ocupa 3 renglones y se abre con un clic, para que un tablero
   * con muchos pedidos no sea un scroll interminable. La elección se recuerda en el navegador.
   */
  const [compact, setCompact] = useState(true);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      if (localStorage.getItem("vv.board.compact") === "0") setCompact(false);
    } catch {
      /* sin almacenamiento: queda compacta */
    }
  }, []);
  const toggleCompact = (value: boolean) => {
    setCompact(value);
    setOpened(new Set());
    try {
      localStorage.setItem("vv.board.compact", value ? "1" : "0");
    } catch {
      /* sin almacenamiento */
    }
  };
  const toggleCard = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    setUser(getUser());
    api<Sector[]>("/sectors").then(setSectors).catch(() => undefined);
    api<Reason[]>("/file-error-reasons").then(setReasons).catch(() => undefined);
  }, []);

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

  /** D-062: descarga los archivos del pedido para imprimir (la API controla que esté liberado). */
  async function downloadForPrint(jobId: string) {
    try {
      const detail = await api<{ files: { id: string; filename: string }[] }>(`/jobs/${jobId}`);
      for (const f of detail.files) await downloadFile(`/jobs/${jobId}/files/${f.id}`, f.filename);
      if (!detail.files.length) setToast("Este pedido no tiene archivos guardados.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "No pudimos descargar el archivo.");
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

  const flow = board?.columns.filter((c) => c.status !== "FILE_ERROR" && c.status !== "PENDING_SIGNUP") ?? [];
  const stepOf = (s: Status) => flow.findIndex((c) => c.status === s);

  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="page-head">
          <h1>
            Tablero · {board?.sector.name ?? "…"}
            <Help label="Cómo funciona el tablero">
              <strong>Pasos obligatorios:</strong> cada trabajo avanza de a un paso y no se puede saltear ninguno.
              <br />
              El archivo para imprimir se libera recién cuando la orden está lista (cotizada y, si corresponde, con seña).
              <br />
              El cliente ve cada cambio en su app al instante. En amarillo: más de 2 h en el mismo paso.
            </Help>
          </h1>
          <span className="live" data-on={live}>
            {live ? `En vivo · ${total} órdenes` : "Reconectando…"}
          </span>
        </div>
      </div>

      <div className="board-top">
        <nav className="sector-tabs" aria-label="Sectores">
          {sectors.map((s) => (
            <Link key={s.code} href={`/produccion/${s.code}`} className="sector-tab" aria-current={s.code === sector ? "page" : undefined}>
              {s.name}
            </Link>
          ))}
        </nav>
      </div>

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
        <label className="toggle">
          <input type="checkbox" checked={groupByMaterial} onChange={(e) => setGroupByMaterial(e.target.checked)} />
          Agrupar por material
        </label>
        <label className="toggle">
          <input type="checkbox" checked={compact} onChange={(e) => toggleCompact(e.target.checked)} />
          Vista compacta
        </label>
      </div>

      <main className="board">
        {board?.columns.map((col) => (
          <section
            key={col.status}
            className="column"
            aria-label={col.label}
            style={{ ["--col" as string]: STATUS_COLOR[col.status] }}
          >
            <div className="column-head">
              <span className="column-dot" />
              <h2>{col.label}</h2>
              {stepOf(col.status) >= 0 && <span className="column-step">Paso {stepOf(col.status) + 1}</span>}
              <span className="column-count">{col.cards.length}</span>
            </div>
            <div className="cards">
              {col.cards.length === 0 && (
                <div className="empty">
                  <FileText size={18} aria-hidden />
                  Sin órdenes
                </div>
              )}
              {col.cards.map((card) => {
                const mins = minutesSince(card.createdAt, now);
                const step = stepOf(card.status);
                const open = !compact || opened.has(card.id);
                if (!open) {
                  const check = card.status === "RECEIVED" ? card.fileCheck?.verdict : undefined;
                  return (
                    <article key={card.id} className="card card-compact" aria-busy={busy === card.id}>
                      <button type="button" className="card-toggle" aria-expanded={false} onClick={() => toggleCard(card.id)} title="Ver el pedido completo">
                        <span className="row">
                          <span className="num">{card.label}</span>
                          <span className="age" data-late={mins > LATE_MIN}>
                            <Clock size={12} aria-hidden /> {age(card.createdAt, now)}
                          </span>
                        </span>
                        <span className="row">
                          <span className="who-line">{card.customer.name ?? `Cliente N.º ${card.customer.number}`}</span>
                          <span className="mini">
                            {(check === "error" || check === "review") && <span className={`dot ${check}`} title={card.fileCheck?.detail} />}
                            {card.quotedAmount && <span>{money.format(Number(card.quotedAmount))}</span>}
                            {card.depositRequired && card.next === "DEPOSIT_RECEIVED" && <span className="warn">Seña</span>}
                          </span>
                        </span>
                        {card.description && <span className="desc-line">{card.description}</span>}
                      </button>
                      {card.next && (
                        <button className="btn btn-primary btn-sm" disabled={busy === card.id} onClick={() => clickNext(card)}>
                          {NEXT_ACTION[card.next] ?? "Avanzar"}
                        </button>
                      )}
                    </article>
                  );
                }
                return (
                <article key={card.id} className="card" aria-busy={busy === card.id}>
                  <header>
                    {compact ? (
                      <button type="button" className="num num-btn" aria-expanded onClick={() => toggleCard(card.id)} title="Achicar">
                        {card.label} ▴
                      </button>
                    ) : (
                      <span className="num">{card.label}</span>
                    )}
                    <span className="age" data-late={mins > LATE_MIN} title={fullDate.format(new Date(card.createdAt))}>
                      <Clock size={12} aria-hidden /> {age(card.createdAt, now)}
                    </span>
                  </header>
                  <div className="who">
                    <span className="avatar avatar-sm">{initials(card.customer.name)}</span>
                    <span>
                      {card.customer.name ?? "Cliente sin nombre"}
                      <small>Cliente N.º {card.customer.number}</small>
                    </span>
                  </div>
                  {card.description && <div className="desc">{card.description}</div>}
                  {step >= 0 && (
                    <div className="steps" aria-label={`Paso ${step + 1} de ${flow.length}`}>
                      {flow.map((c, i) => (
                        <span key={c.status} data-done={i <= step} />
                      ))}
                    </div>
                  )}
                  <div className="chips">
                    <span className="chip">
                      <Paperclip size={12} aria-hidden /> {card.fileCount} {card.fileCount === 1 ? "archivo" : "archivos"}
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

                  {card.status === "RECEIVED" && (card.fileCheck?.verdict === "error" || card.fileCheck?.verdict === "review") && (
                    <p className={`file-check ${card.fileCheck.verdict}`} title={card.fileCheck.detail}>
                      <b>{card.fileCheck.verdict === "error" ? "Archivo con problema" : "Revisar el archivo"}:</b> {card.fileCheck.detail}
                    </p>
                  )}
                  {card.status === "RECEIVED" && card.fileCheck?.verdict === "ok" && <p className="file-check ok">Archivo controlado: {card.fileCheck.detail}</p>}

                  {card.fileCount > 0 && ["RECEIVED", "QUOTED", "DEPOSIT_RECEIVED"].includes(card.status) && (
                    printUnlocked(card) ? (
                      <button
                        className="btn btn-ghost"
                        onClick={() => void downloadForPrint(card.id)}
                      >
                        <Download size={14} aria-hidden /> Descargar archivo para imprimir
                      </button>
                    ) : (
                      <button className="btn btn-ghost" disabled title="Se libera cuando la orden está lista para imprimir">
                        <Lock size={14} aria-hidden /> Archivo bloqueado hasta {card.status === "RECEIVED" ? "cotizar" : "registrar la seña"}
                      </button>
                    )
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
                );
              })}
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
                  <MoneyInput name="amount" placeholder="Ej.: 18.500,50" required autoFocus />
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
