"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { DEFAULT_ALERT_SETTINGS, ROLE_PERMISSIONS, USER_ROLE_LABELS, USER_ROLES, type AlertSettings, type UserRole } from "@viavinilo/contracts";
import { api, ApiError, getUser } from "../../lib/api";
import { Badge, PageHead } from "../ui";

/**
 * Configuración del ERP (D-067): usuarios con sus roles y tableros, máquinas, motivos de error y
 * avisos de la campanita. Solo el dueño. Datos fiscales y certificados de ARCA son de la Etapa 3.
 */
const TABS = ["Usuarios y roles", "Tableros y máquinas", "Motivos de error", "Avisos", "Datos fiscales", "Certificados ARCA"] as const;
type Tab = (typeof TABS)[number];

interface SectorRef {
  id: string;
  name: string;
}
interface StaffUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  active: boolean;
  sectors: SectorRef[];
}
interface Machine {
  id: string;
  name: string;
  active: boolean;
  jobs: number;
  sectors: SectorRef[];
}
interface Reason {
  id: string;
  label: string;
  active: boolean;
}

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");

/** Contraseña fácil de dictar: palabra-números-letras. */
function generatePassword(): string {
  const words = ["vinilo", "remera", "plotter", "calandra", "sticker", "tablero"];
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  const letters = "abcdefghjkmnpqrstuvwxyz";
  return `${words[r[0]! % words.length]}-${String(r[1]! % 10000).padStart(4, "0")}-${letters[r[2]! % 23]}${letters[(r[2]! >> 8) % 23]}`;
}

function SectorChecks({ sectors, value, onChange }: { sectors: SectorRef[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="check-grid">
      {sectors.map((s) => (
        <label key={s.id} className="check">
          <input type="checkbox" checked={value.includes(s.id)} onChange={(e) => onChange(e.target.checked ? [...value, s.id] : value.filter((x) => x !== s.id))} />
          {s.name}
        </label>
      ))}
    </div>
  );
}

function UserDialog({ user, sectors, onClose, onSaved }: { user: StaffUser | null; sectors: SectorRef[]; onClose: () => void; onSaved: (notice: string) => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roles, setRoles] = useState<UserRole[]>(user?.roles ?? ["PRODUCTION"]);
  const [sectorIds, setSectorIds] = useState<string[]>(user?.sectors.map((s) => s.id) ?? []);
  const [password, setPassword] = useState(user ? "" : generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onlyProduction = roles.length > 0 && roles.every((r) => r === "PRODUCTION");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ name, email, roles, sectorIds }) });
        if (password) await api(`/admin/users/${user.id}/password`, { method: "POST", body: JSON.stringify({ password }) });
        onSaved(password ? "Usuario guardado y contraseña cambiada. Pasásela en persona." : "Usuario guardado.");
      } else {
        await api("/admin/users", { method: "POST", body: JSON.stringify({ name, email, roles, sectorIds, password }) });
        onSaved(`Usuario creado. Pasale su email y la contraseña en persona; después no se vuelve a mostrar.`);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog dialog-wide" onSubmit={submit} role="dialog" aria-modal="true">
        <h3>{user ? "Editar usuario" : "Nuevo usuario"}</h3>
        <label className="field">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
        </label>
        <label className="field">
          Email (con este entra al sistema)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="field">
          Rol
          <div className="check-grid">
            {USER_ROLES.map((r) => (
              <label key={r} className="check">
                <input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />
                {USER_ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          Tableros que ve
          {onlyProduction ? (
            <SectorChecks sectors={sectors} value={sectorIds} onChange={setSectorIds} />
          ) : (
            <span className="muted">Dueño y Atención ven todos los tableros.</span>
          )}
        </div>
        <label className="field">
          {user ? "Nueva contraseña (dejala vacía para no cambiarla)" : "Contraseña"}
          <div className="contact-row">
            <input className="mono" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} minLength={10} placeholder="Mínimo 10 caracteres" autoComplete="off" />
            <button type="button" className="btn btn-ghost" onClick={() => setPassword(generatePassword())}>
              Generar
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || roles.length === 0}>
            {busy ? "Guardando…" : user ? "Guardar" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function ConfiguracionPage() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Usuarios y roles");
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [sectors, setSectors] = useState<SectorRef[]>([]);
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [reasons, setReasons] = useState<Reason[] | null>(null);
  const [alerts, setAlerts] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [machineName, setMachineName] = useState("");
  const [machineSectors, setMachineSectors] = useState<string[]>([]);
  const [reasonLabel, setReasonLabel] = useState("");

  useEffect(() => {
    setIsOwner(getUser()?.roles.includes("OWNER") ?? false);
    // La campanita trae directo a los tiempos de los avisos.
    if (new URLSearchParams(window.location.search).get("tab") === "avisos") setTab("Avisos");
  }, []);

  const load = useCallback(async () => {
    try {
      const [u, s, m, r, a] = await Promise.all([
        api<StaffUser[]>("/admin/users"),
        api<(SectorRef & { active: boolean })[]>("/sectors/all"),
        api<Machine[]>("/admin/machines"),
        api<Reason[]>("/admin/error-reasons"),
        api<AlertSettings>("/admin/alerts"),
      ]);
      setUsers(u);
      setSectors(s.filter((x) => x.active));
      setMachines(m);
      setReasons(r);
      setAlerts(a);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError("");
    setNotice("");
    try {
      await fn();
      if (done) setNotice(done);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (isOwner === null) return <div className="page"><PageHead title="Configuración" /><div className="empty" style={{ padding: 32 }}>Cargando…</div></div>;
  if (!isOwner) return <div className="page"><PageHead title="Configuración" /><div className="empty" style={{ padding: 32 }}>La configuración la maneja el dueño.</div></div>;

  return (
    <div className="page">
      <PageHead
        title="Configuración"
        help="Usuarios con su rol y sus tableros, máquinas, motivos de error y los tiempos de los avisos de la campanita. Todo cambio queda registrado con quién lo hizo."
        actions={
          tab === "Usuarios y roles" ? (
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={16} aria-hidden /> Nuevo usuario
            </button>
          ) : undefined
        }
      />
      <div className="seg seg-tabs">
        {TABS.map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => (setTab(t), setNotice(""), setError(""))}>
            {t}
          </button>
        ))}
      </div>
      {notice && <div className="notice">{notice}</div>}
      {error && <p className="error">{error}</p>}

      {tab === "Usuarios y roles" && (
        <>
          <section className="panel">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Tableros</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u) => (
                    <tr key={u.id}>
                      <td className="cell-title">{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.roles.map((r) => USER_ROLE_LABELS[r]).join(" · ")}</td>
                      <td>{u.roles.some((r) => r !== "PRODUCTION") ? "Todos" : u.sectors.map((s) => s.name).join(", ") || <span className="muted">Ninguno</span>}</td>
                      <td>
                        <Badge tone={u.active ? "ok" : "neutral"}>{u.active ? "Activo" : "Desactivado"}</Badge>
                      </td>
                      <td className="row-actions">
                        <button className="btn btn-ghost" onClick={() => setEditing(u)}>
                          Editar
                        </button>
                        <button className="btn btn-ghost" onClick={() => void run(() => api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) }))}>
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!users && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty" style={{ padding: 32 }}>Cargando…</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <Panel title="Qué puede hacer cada rol">
            <div className="panel-body role-grid">
              {USER_ROLES.map((r) => (
                <div key={r}>
                  <strong>{USER_ROLE_LABELS[r]}</strong>
                  <ul>
                    {ROLE_PERMISSIONS[r].map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {tab === "Tableros y máquinas" && (
        <>
          <Panel title="Tableros">
            <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span>{sectors.map((s) => s.name).join(" · ")}</span>
              <Link href="/produccion/tableros" className="btn btn-ghost">
                Administrar tableros
              </Link>
            </div>
          </Panel>
          <Panel title="Máquinas">
            <form
              className="panel-body form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api("/admin/machines", { method: "POST", body: JSON.stringify({ name: machineName, sectorIds: machineSectors }) }), "Máquina creada.").then(() => (setMachineName(""), setMachineSectors([])));
              }}
            >
              <label className="field">
                Nueva máquina
                <input value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="Ej.: DTF 60 cm n.º 2" required minLength={2} />
              </label>
              <div className="field field-wide">
                Tableros en los que trabaja
                <SectorChecks sectors={sectors} value={machineSectors} onChange={setMachineSectors} />
              </div>
              <div className="field-wide form-actions">
                <button className="btn btn-primary" disabled={machineName.trim().length < 2}>
                  <Plus size={16} aria-hidden /> Agregar máquina
                </button>
              </div>
            </form>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Máquina</th>
                    <th>Tableros</th>
                    <th className="num">Pedidos</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {machines?.map((m) => (
                    <tr key={m.id}>
                      <td className="cell-title">{m.name}</td>
                      <td>{m.sectors.map((s) => s.name).join(", ") || <span className="muted">Ninguno</span>}</td>
                      <td className="num">{m.jobs}</td>
                      <td>
                        <Badge tone={m.active ? "ok" : "neutral"}>{m.active ? "Activa" : "Desactivada"}</Badge>
                      </td>
                      <td className="row-actions">
                        <button className="btn btn-ghost" onClick={() => void run(() => api(`/admin/machines/${m.id}`, { method: "PATCH", body: JSON.stringify({ active: !m.active }) }))}>
                          {m.active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {tab === "Motivos de error" && (
        <Panel title="Motivos de 'Archivo con error'">
          <form
            className="panel-body"
            style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api("/admin/error-reasons", { method: "POST", body: JSON.stringify({ label: reasonLabel }) }), "Motivo agregado.").then(() => setReasonLabel(""));
            }}
          >
            <label className="field" style={{ flex: 1, minWidth: 260 }}>
              Nuevo motivo (el cliente lo lee en el aviso)
              <input value={reasonLabel} onChange={(e) => setReasonLabel(e.target.value)} placeholder="Ej.: Falta el fondo transparente" required minLength={3} />
            </label>
            <button className="btn btn-primary" disabled={reasonLabel.trim().length < 3}>
              <Plus size={16} aria-hidden /> Agregar
            </button>
          </form>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {reasons?.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-title">{r.label}</td>
                    <td>
                      <Badge tone={r.active ? "ok" : "neutral"}>{r.active ? "Activo" : "Desactivado"}</Badge>
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-ghost" onClick={() => void run(() => api(`/admin/error-reasons/${r.id}`, { method: "PATCH", body: JSON.stringify({ active: !r.active }) }))}>
                        {r.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "Avisos" && (
        <Panel title="Avisos de la campanita">
          <form
            className="panel-body form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api("/admin/alerts", { method: "PUT", body: JSON.stringify(alerts) }), "Tiempos guardados.");
            }}
          >
            <label className="field">
              Chat sin atención después de (minutos)
              <input type="number" min={5} max={1440} value={alerts.unansweredMinutes} onChange={(e) => setAlerts({ ...alerts, unansweredMinutes: Number(e.target.value) })} required />
            </label>
            <label className="field">
              Pedido sin cotizar después de (horas)
              <input type="number" min={1} max={336} value={alerts.unquotedHours} onChange={(e) => setAlerts({ ...alerts, unquotedHours: Number(e.target.value) })} required />
            </label>
            <label className="field">
              Alta pendiente sin aprobar después de (horas)
              <input type="number" min={1} max={720} value={alerts.pendingSignupHours} onChange={(e) => setAlerts({ ...alerts, pendingSignupHours: Number(e.target.value) })} required />
            </label>
            <label className="field">
              Pedido demorado: más de (horas) en el mismo paso
              <input type="number" min={1} max={720} value={alerts.delayedHours} onChange={(e) => setAlerts({ ...alerts, delayedHours: Number(e.target.value) })} required />
            </label>
            <p className="muted field-wide" style={{ margin: 0 }}>
              El tiempo de "demorado" se usa en Inicio y en el Panel de tiempos. La campanita también avisa siempre los chats que piden un asesor, los mensajes nuevos y los archivos con problema.
            </p>
            <div className="field-wide form-actions">
              <button className="btn btn-primary">Guardar tiempos</button>
            </div>
          </form>
        </Panel>
      )}

      {(tab === "Datos fiscales" || tab === "Certificados ARCA") && (
        <div className="empty" style={{ padding: 48 }}>
          <strong>{tab}</strong>
          <span>Se configura en la Etapa 3, junto con la facturación con ARCA.</span>
        </div>
      )}

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          sectors={sectors}
          onClose={() => setEditing(null)}
          onSaved={(n) => {
            setEditing(null);
            setNotice(n);
            void load();
          }}
        />
      )}
    </div>
  );
}
