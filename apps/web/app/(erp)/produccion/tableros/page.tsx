"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, ApiError, getUser } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";

/**
 * Administrar tableros (D-064): el dueño crea tableros nuevos (por ejemplo TPU o Corte), les pone
 * su casilla de mail y los desactiva. Un tablero nuevo aparece en el menú, lo conoce el bot y la app
 * lo ofrece al mandar un archivo. Si tiene casilla, los mails que lleguen ahí crean pedidos solos.
 */
interface Sector {
  id: string;
  code: string;
  name: string;
  inboxEmail: string | null;
  active: boolean;
  jobs: number;
  stages: string[];
}

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");

export default function TablerosPage() {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [inboxEmail, setInboxEmail] = useState("");
  const [withCalender, setWithCalender] = useState(false);
  const [busy, setBusy] = useState(false);
  // El rol se lee después de montar: en el servidor no hay sesión y el primer dibujo tiene que coincidir.
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  useEffect(() => setIsOwner(getUser()?.roles.includes("OWNER") ?? false), []);
  /** Paso automático a "Archivo con error" (D-065). */
  const [autoCheck, setAutoCheck] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ enabled: boolean }>("/settings/file-check").then((r) => setAutoCheck(r.enabled)).catch(() => setAutoCheck(null));
  }, []);
  async function toggleAutoCheck() {
    setError("");
    try {
      const r = await api<{ enabled: boolean }>("/settings/file-check", { method: "PUT", body: JSON.stringify({ enabled: !autoCheck }) });
      setAutoCheck(r.enabled);
    } catch (err) {
      setError(errorText(err));
    }
  }

  const load = useCallback(async () => {
    try {
      setSectors(await api<Sector[]>("/sectors/all"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const s = await api<{ name: string }>("/sectors", { method: "POST", body: JSON.stringify({ name, inboxEmail, withCalender }) });
      setNotice(`Tablero "${s.name}" creado. Ya está en el menú Producción.`);
      window.dispatchEvent(new Event("vv:sectors"));
      setName("");
      setInboxEmail("");
      setWithCalender(false);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: object) {
    setError("");
    try {
      await api(`/sectors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      window.dispatchEvent(new Event("vv:sectors"));
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (isOwner === null) {
    return (
      <div className="page page-narrow">
        <PageHead title="Administrar tableros" />
        <div className="empty" style={{ padding: 32 }}>Cargando…</div>
      </div>
    );
  }
  if (!isOwner) {
    return (
      <div className="page page-narrow">
        <PageHead title="Administrar tableros" />
        <div className="empty" style={{ padding: 32 }}>Los tableros los crea y los cambia el dueño.</div>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <PageHead
        title="Administrar tableros"
        help="Cada tablero es un sector de producción con sus pasos. Uno nuevo aparece en el menú, lo conoce el bot y la app lo ofrece al mandar un archivo. Si le ponés una casilla de mail, los mails que lleguen ahí crean pedidos en ese tablero."
      />
      {notice && <div className="notice">{notice}</div>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Control automático de archivos</h2>
        </div>
        <div className="panel-body" style={{ display: "grid", gap: 10 }}>
          <p className="muted" style={{ margin: 0 }}>
            Cada archivo PNG o JPG que entra se compara con la medida que pidió el cliente. El resultado se ve en la tarjeta del
            pedido. Con esto prendido, si la resolución es menos de la mitad de la mínima (250 dpi en DTF y DTF UV, 100 en el
            resto), el pedido pasa solo a "Archivo con error" con el motivo. Cuando el cliente manda el archivo corregido, vuelve
            solo a "Archivo recibido".
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={autoCheck ? "ok" : "neutral"}>{autoCheck === null ? "…" : autoCheck ? "Prendido" : "Apagado"}</Badge>
            <button className={`btn ${autoCheck ? "btn-ghost" : "btn-primary"}`} disabled={autoCheck === null} onClick={() => void toggleAutoCheck()}>
              {autoCheck ? "Apagar el paso automático" : "Prender el paso automático"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Nuevo tablero</h2>
        </div>
        <form className="panel-body form-grid" onSubmit={create}>
          <label className="field">
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: TPU" required minLength={2} maxLength={40} />
          </label>
          <label className="field">
            Casilla de mail (opcional)
            <input type="email" value={inboxEmail} onChange={(e) => setInboxEmail(e.target.value)} placeholder="tpu@viavinilo.com" />
          </label>
          <label className="check" style={{ alignSelf: "end", paddingBottom: 8 }}>
            <input type="checkbox" checked={withCalender} onChange={(e) => setWithCalender(e.target.checked)} />
            Lleva el paso "En proceso de calandra"
          </label>
          <div className="field-wide form-actions">
            <button className="btn btn-primary" disabled={busy || name.trim().length < 2}>
              <Plus size={16} aria-hidden /> Crear tablero
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Tablero</th>
                <th>Casilla de mail</th>
                <th>Pasos</th>
                <th className="num">Pedidos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sectors?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/produccion/${s.code}`} className="cell-title">
                      {s.name}
                    </Link>
                  </td>
                  <td>{s.inboxEmail ?? <span className="muted">Sin casilla</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{s.stages.join(" → ")}</td>
                  <td className="num">{s.jobs}</td>
                  <td>
                    <Badge tone={s.active ? "ok" : "neutral"}>{s.active ? "Activo" : "Desactivado"}</Badge>
                  </td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => void patch(s.id, { active: !s.active })}>
                      {s.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {!sectors && (
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
    </div>
  );
}
