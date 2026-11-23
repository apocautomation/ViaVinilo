"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, FileText, MessageCircle, PackageCheck, Upload, X } from "lucide-react";
import { AppBar, StatusPill } from "../../../components";
import { STATUS_LABEL, ars, formatWhen, type Order, type Status } from "../../../data";
import { api, ApiError } from "../../../session";

/** Detalle de un pedido: estado, precio, cuándo está listo, historial y archivos (SPEC E1.5). */
export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const [o, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function cancelOrder() {
    setCancelling(true);
    setCancelError("");
    try {
      await api(`/app/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      router.replace("/");
    } catch (e) {
      setCancelError(e instanceof ApiError ? e.message : "No pudimos cancelar el pedido. Probá de nuevo.");
      setCancelling(false);
      setConfirming(false);
    }
  }
  useEffect(() => {
    const load = () =>
      api<Order>(`/app/jobs/${encodeURIComponent(id)}`)
        .then((r) => (setOrder(r), setState("ok")))
        .catch(() => setState((s) => (s === "ok" ? "ok" : "missing")));
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), 30_000);
    return () => clearInterval(timer);
  }, [id]);

  if (state === "loading") {
    return (
      <>
        <AppBar title="Pedido" back />
        <main className="screen">
          <p className="muted center">Cargando…</p>
        </main>
      </>
    );
  }
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
  const when = (s: Status) => {
    const at = o.history.find((h) => h.status === s)?.at;
    return at ? formatWhen(at) : undefined;
  };
  const amount = o.amount ? Number(o.amount) : null;
  const deposit = o.depositAmount ? Number(o.depositAmount) : null;

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
          <span className="big">{amount !== null ? ars.format(amount) : "Sin cotizar"}</span>
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
            <Link href={`/chat?pedido=${o.num}`} className="btn btn-danger btn-block">
              <Upload size={18} /> Reenviar el archivo por el chat
            </Link>
          </section>
        )}

        {o.status === "CANCELLED" && (
          <div className="alert alert-bad">
            <X size={18} />
            <span>
              <strong>Este pedido fue cancelado.</strong> Si tenés dudas, consultanos por el chat.
            </span>
          </div>
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
            <dd>{o.measure || "—"}</dd>
            <dt>Precio</dt>
            <dd>{amount !== null ? ars.format(amount) : "—"}</dd>
            {o.depositRequired && (
              <>
                <dt>Seña</dt>
                <dd>
                  {deposit !== null ? `${ars.format(deposit)} · ` : ""}
                  {o.depositPaid ? "pagada" : "pendiente"}
                </dd>
                {o.depositPaid && deposit !== null && amount !== null && (
                  <>
                    <dt>Saldo a pagar</dt>
                    <dd>{ars.format(amount - deposit)}</dd>
                  </>
                )}
              </>
            )}
            <dt>Listo para retirar</dt>
            <dd>{o.readyAt ? formatWhen(o.readyAt) : "—"}</dd>
            <dt>Enviado por</dt>
            <dd>{o.channel === "App" ? "La app" : o.channel}</dd>
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
            o.status !== "CANCELLED" &&
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
          {o.files.length === 0 && <p className="muted" style={{ margin: 0, padding: 16 }}>No hay archivos guardados para este pedido.</p>}
          {o.files.map((f) => (
            <div key={f.name} className="file">
              <span className="file-ico">
                <FileText size={18} />
              </span>
              <span>
                {f.name}
                <small>{f.available ? f.size : "Ya no está guardado (se borra a los 30 días de la entrega)"}</small>
              </span>
            </div>
          ))}
        </section>

        <Link href={`/chat?pedido=${o.num}`} className="btn btn-ghost btn-block">
          <MessageCircle size={18} /> Consultar por este pedido
        </Link>

        {/* D-074: el cliente cancela solo mientras el pedido no pasó de "Cotizado". */}
        {o.canCancel && !confirming && (
          <button className="btn btn-ghost btn-block" style={{ color: "var(--color-danger)" }} onClick={() => setConfirming(true)}>
            <X size={18} /> Cancelar este pedido
          </button>
        )}
        {o.canCancel && confirming && (
          <section className="card card-pad" style={{ display: "grid", gap: 12 }}>
            <strong>¿Cancelás el pedido {o.num}?</strong>
            <span className="muted">No se puede deshacer. Si después lo querés, tenés que mandarlo de nuevo.</span>
            <button className="btn btn-danger btn-block" disabled={cancelling} onClick={() => void cancelOrder()}>
              {cancelling ? "Cancelando…" : "Sí, cancelar el pedido"}
            </button>
            <button className="btn btn-ghost btn-block" disabled={cancelling} onClick={() => setConfirming(false)}>
              No, lo dejo
            </button>
          </section>
        )}
        {cancelError && <p className="muted center" style={{ color: "var(--color-danger)" }}>{cancelError}</p>}
      </main>
    </>
  );
}
