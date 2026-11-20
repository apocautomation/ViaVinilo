"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Check, FileText, MessageCircle, PackageCheck, Upload, X } from "lucide-react";
import { AppBar, StatusPill } from "../../../components";
import { ORDERS, STATUS_LABEL, ars, type Status } from "../../../data";

/** Detalle de un pedido: estado, precio, cuándo está listo, historial y archivos (SPEC E1.5). */
export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const o = ORDERS.find((x) => x.id === id);
  if (!o) {
    return (
      <>
        <AppBar title="Pedido" back />
        <main className="screen">
          <p className="muted center">No encontramos ese pedido.</p>
        </main>
      </>
    );
  }

  const error = o.status === "FILE_ERROR";
  const pos = o.steps.indexOf(o.status);
  const when = (s: Status) => o.history.find((h) => h.status === s)?.at;

  return (
    <>
      <AppBar title={o.num} back />
      <main className="screen">
        <section className="card detail-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <StatusPill status={o.status} />
            <span className="muted" style={{ fontSize: 13 }}>
              {o.sector}
            </span>
          </div>
          <span className="big">{o.amount ? ars.format(o.amount) : "Sin cotizar"}</span>
          <span className="muted">{o.desc}</span>
        </section>

        {error && (
          <section className="card card-pad" style={{ display: "grid", gap: 12 }}>
            <div className="alert alert-bad">
              <AlertTriangle size={18} />
              <span>
                <strong>Hay un problema con el archivo.</strong> {o.error}
              </span>
            </div>
            <button className="btn btn-danger btn-block">
              <Upload size={18} /> Reenviar archivo
            </button>
          </section>
        )}

        {o.status === "READY" && (
          <div className="alert alert-ok">
            <PackageCheck size={18} />
            <span>
              <strong>Listo para retirar.</strong> Presentá el número {o.num} en el mostrador.
            </span>
          </div>
        )}

        <section className="card card-pad">
          <dl className="kv">
            <dt>Medida</dt>
            <dd>{o.measure}</dd>
            <dt>Precio</dt>
            <dd>{o.amount ? ars.format(o.amount) : "—"}</dd>
            {o.deposit && (
              <>
                <dt>Seña</dt>
                <dd>{ars.format(o.deposit)} · pagada</dd>
                <dt>Saldo a pagar</dt>
                <dd>{ars.format((o.amount ?? 0) - o.deposit)}</dd>
              </>
            )}
            <dt>Listo para retirar</dt>
            <dd>{o.readyAt ?? "—"}</dd>
            <dt>Enviado por</dt>
            <dd>{o.channel === "App" ? "La app" : "Mail"}</dd>
          </dl>
        </section>

        <h2 className="section-title">Seguimiento</h2>
        <ol className="card timeline">
          {error && (
            <>
              <li data-state="done">
                <span className="tl-dot">
                  <Check size={15} />
                </span>
                <span className="tl-text">
                  <strong>{STATUS_LABEL.RECEIVED}</strong>
                  <span>{when("RECEIVED")}</span>
                </span>
              </li>
              <li data-state="error">
                <span className="tl-dot">
                  <X size={15} />
                </span>
                <span className="tl-text">
                  <strong>{STATUS_LABEL.FILE_ERROR}</strong>
                  <span>{when("FILE_ERROR")} · esperando que lo reenvíes</span>
                </span>
              </li>
            </>
          )}
          {!error &&
            o.steps.map((s, i) => {
              const state = i < pos || o.status === "DELIVERED" ? "done" : i === pos ? "current" : "todo";
              return (
                <li key={s} data-state={state}>
                  <span className="tl-dot">{state === "done" ? <Check size={15} /> : i + 1}</span>
                  <span className="tl-text">
                    <strong>{STATUS_LABEL[s]}</strong>
                    <span>{when(s) ?? (state === "todo" ? "Pendiente" : "")}</span>
                  </span>
                </li>
              );
            })}
        </ol>

        <h2 className="section-title">Archivos</h2>
        <section className="card">
          {o.files.map((f) => (
            <div key={f.name} className="file">
              <span className="file-ico">
                <FileText size={18} />
              </span>
              <span>
                {f.name}
                <small>{f.size}</small>
              </span>
            </div>
          ))}
        </section>

        <Link href={`/chat?pedido=${o.num}`} className="btn btn-ghost btn-block">
          <MessageCircle size={18} /> Consultar por este pedido
        </Link>
      </main>
    </>
  );
}
