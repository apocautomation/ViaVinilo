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
  const isOwner = getUser()?.roles.includes("OWNER") ?? false;

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
