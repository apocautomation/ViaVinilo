"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, ApiError, getUser } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";

/**
 * Opciones de impresión por tablero (D-095, D-102, D-108): "Glitter" en DTF Textil, la tela en
 * Calandrado. El cliente la elige en la app al mandar el trabajo, el pedido lleva su código y en el
 * tablero se agrupan los pedidos de la misma opción. Cada opción tiene su código de Tango y sus anchos
 * (catálogo de Ricardo). Lo administra el dueño.
 */
interface Variant {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  tangoSku: string | null;
  width: string | null;
  usableWidth: string | null;
}
interface Sector {
  id: string;
  code: string;
  name: string;
  parent: string | null;
  active: boolean;
  variants: Variant[];
}

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");

export default function OpcionesPage() {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => setIsOwner(getUser()?.roles.includes("OWNER") ?? false), []);

  const load = useCallback(async () => {
    try {
      setSectors((await api<Sector[]>("/sectors/all")).filter((s) => s.active));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(ok);
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (isOwner === false) {
    return (
      <div className="page">
        <PageHead title="Opciones de impresión" />
        <p className="muted">Las opciones de impresión las administra el dueño.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title="Opciones de impresión"
        help="Las opciones de impresión de cada tablero (por ejemplo Glitter en DTF Textil, o la tela en Calandrado), con su código de Tango y el ancho del material. El cliente elige una al mandar el trabajo y el pedido queda con su código. En el tablero, «Agrupar por opción» junta los pedidos de la misma opción. Desactivar una opción deja de ofrecerla, pero los pedidos que ya la tienen la conservan."
      />
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      {!sectors && !error && <div className="empty">Cargando…</div>}
      {sectors?.map((s) => (
        <SectorVariants key={s.id} sector={s} run={run} />
      ))}
    </div>
  );
}

function SectorVariants({ sector, run }: { sector: Sector; run: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tangoSku, setTangoSku] = useState("");
  const [width, setWidth] = useState("");
  const [usableWidth, setUsableWidth] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api(`/sectors/${sector.id}/variants`, { method: "POST", body: JSON.stringify({ code, name, tangoSku, width, usableWidth }) });
      setCode("");
      setName("");
      setTangoSku("");
      setWidth("");
      setUsableWidth("");
    }, `Opción agregada a ${sector.name}.`);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          {sector.name}
          {sector.parent && <span className="muted" style={{ fontWeight: 500 }}> · dentro de {sector.parent}</span>}
        </h2>
        <Badge tone={sector.variants.some((v) => v.active) ? "info" : "neutral"}>{sector.variants.filter((v) => v.active).length} activos</Badge>
      </div>
      {sector.variants.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Opción de impresión</th>
                <th>Código Tango</th>
                <th>Ancho · útil (cm)</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sector.variants.map((v) => (
                <tr key={v.id}>
                  <td className="mono">{v.code}</td>
                  <td>{v.name}</td>
                  <td className="mono">{v.tangoSku ?? "—"}</td>
                  <td>{v.width ? `${v.width} · ${v.usableWidth ?? "—"}` : "—"}</td>
                  <td>{v.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="neutral">Desactivado</Badge>}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void run(() => api(`/variants/${v.id}`, { method: "PATCH", body: JSON.stringify({ active: !v.active }) }), v.active ? `${v.name} desactivado.` : `${v.name} activado.`)}
                    >
                      {v.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="panel-body filters" onSubmit={add} style={{ padding: "12px 16px" }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código · ej.: SET" maxLength={10} aria-label={`Código de la opción para ${sector.name}`} required style={{ width: 140 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre · ej.: Jersey Set Premium" maxLength={40} aria-label={`Nombre de la opción para ${sector.name}`} required />
        <input value={tangoSku} onChange={(e) => setTangoSku(e.target.value.toUpperCase())} placeholder="Código Tango · ej.: TECA00001" maxLength={30} aria-label={`Código de Tango de la opción para ${sector.name}`} style={{ width: 190 }} />
        <input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="Ancho (cm)" maxLength={20} aria-label={`Ancho del material para ${sector.name}`} style={{ width: 110 }} />
        <input value={usableWidth} onChange={(e) => setUsableWidth(e.target.value)} placeholder="Ancho útil (cm)" maxLength={20} aria-label={`Ancho útil para ${sector.name}`} style={{ width: 130 }} />
        <button className="btn btn-primary btn-sm" disabled={!code.trim() || name.trim().length < 2}>
          <Plus size={14} aria-hidden /> Agregar
        </button>
      </form>
    </section>
  );
}
