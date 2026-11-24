"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, ApiError, getUser } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";

/**
 * Materiales u opciones de impresión por tablero (D-095): "Glitter" o "Reflectivo" en DTF Textil, la
 * tela en Calandra. El cliente lo elige en la app al mandar el trabajo, el pedido lleva su código y en
 * el tablero se agrupan los pedidos del mismo material. Lo administra el dueño.
 */
interface Variant {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
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

export default function MaterialesPage() {
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
        <PageHead title="Materiales por tablero" />
        <p className="muted">Los materiales los administra el dueño.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title="Materiales por tablero"
        help="Las opciones de impresión de cada tablero (por ejemplo Glitter o Reflectivo en DTF Textil, o la tela en Calandra). El cliente elige una al mandar el trabajo y el pedido queda con su código. En el tablero, «Agrupar por material» junta los pedidos del mismo material. Desactivar un material deja de ofrecerlo, pero los pedidos que ya lo tienen lo conservan."
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

  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api(`/sectors/${sector.id}/variants`, { method: "POST", body: JSON.stringify({ code, name }) });
      setCode("");
      setName("");
    }, `Material agregado a ${sector.name}.`);
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
                <th>Material u opción</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sector.variants.map((v) => (
                <tr key={v.id}>
                  <td className="mono">{v.code}</td>
                  <td>{v.name}</td>
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
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código · ej.: DTF-GLI" maxLength={20} aria-label={`Código del material para ${sector.name}`} required style={{ width: 170 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre · ej.: Glitter" maxLength={40} aria-label={`Nombre del material para ${sector.name}`} required />
        <button className="btn btn-primary btn-sm" disabled={!code.trim() || name.trim().length < 2}>
          <Plus size={14} aria-hidden /> Agregar
        </button>
      </form>
    </section>
  );
}
