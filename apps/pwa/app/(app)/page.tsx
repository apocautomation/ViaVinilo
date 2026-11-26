"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, PackageCheck } from "lucide-react";
import { AppBar, PushPrompt, StatusPill, StepsBar } from "../components";
import type { AppOrder } from "@viavinilo/contracts";
import { ars, formatWhen } from "../data";
import { api, useSession } from "../session";

/** Mis pedidos: lo primero que ve el cliente al abrir la app (D-034). */
export default function PedidosPage() {
  const { me } = useSession();
  const [tab, setTab] = useState<"curso" | "entregados">("curso");
  const [orders, setOrders] = useState<AppOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      api<{ orders: AppOrder[] }>("/app/jobs")
        .then((r) => (setOrders(r.orders), setFailed(false)))
        .catch(() => setFailed(true));
    void load();
    // El estado se actualiza solo mientras la app está abierta.
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  const all = orders ?? [];
  const finished = (o: AppOrder) => o.status === "DELIVERED" || o.status === "CANCELLED";
  const active = all.filter((o) => !finished(o));
  const list = tab === "curso" ? active : all.filter(finished);
  const ready = active.filter((o) => o.status === "READY").length;
  const errors = active.filter((o) => o.status === "FILE_ERROR").length;

  return (
    <>
      <AppBar />
      <main className="screen">
        <section className="hello">
          <img src="/icons/icon-192.png" alt="" />
          <div>
            <strong>Hola{me.firstName ? `, ${me.firstName}` : ""}</strong>
            <span>
              {me.businessName ? `${me.businessName} · ` : ""}Cliente N.º {me.customerNumber}
            </span>
          </div>
        </section>

        <PushPrompt />

        <div className="stats">
          <div className="card stat">
            <b>{active.length}</b>
            <span>En curso</span>
          </div>
          <div className="card stat">
            <b style={{ color: "var(--color-success)" }}>{ready}</b>
            <span>Para retirar</span>
          </div>
          <div className="card stat">
            <b style={{ color: errors ? "var(--color-danger)" : undefined }}>{errors}</b>
            <span>Con error</span>
          </div>
        </div>

        <div className="seg" role="group" aria-label="Filtrar pedidos">
          <button aria-pressed={tab === "curso"} onClick={() => setTab("curso")}>
            En curso ({active.length})
          </button>
          <button aria-pressed={tab === "entregados"} onClick={() => setTab("entregados")}>
            Entregados
          </button>
        </div>

        {failed && orders === null && (
          <section className="card empty-orders">
            <strong>No pudimos cargar tus pedidos</strong>
            <span className="muted">Revisá la conexión; lo volvemos a intentar solos.</span>
          </section>
        )}
        {orders === null && !failed && <section className="card empty-orders" aria-busy="true"><span className="muted">Cargando tus pedidos…</span></section>}
        {orders !== null && list.length === 0 && (
          <section className="card empty-orders">
            <ClipboardList size={28} aria-hidden />
            <strong>{tab === "curso" ? "No tenés pedidos en curso" : "Todavía no tenés pedidos entregados"}</strong>
            <span className="muted">Cuando nos mandes un trabajo, lo vas a poder seguir acá paso a paso.</span>
          </section>
        )}

        {list.map((o) => (
          <Link key={o.id} href={`/pedidos/${o.id}`} className="card order">
            <div className="order-top">
              <div>
                <span className="order-num">{o.num}</span>
                <div className="order-desc">
                  {o.sector} · {o.desc}
                </div>
              </div>
              <ChevronRight size={20} className="muted" />
            </div>
            <StepsBar order={o} />
            {o.status === "FILE_ERROR" && (
              <div className="alert alert-bad">
                <AlertTriangle size={18} />
                <span>{o.error}</span>
              </div>
            )}
            {o.status === "READY" && (
              <div className="alert alert-ok">
                <PackageCheck size={18} />
                <span>Ya lo podés pasar a buscar.</span>
              </div>
            )}
            <div className="order-foot">
              <StatusPill status={o.status} />
              {o.amount ? <b>{ars.format(Number(o.amount))}</b> : <span>Sin cotizar</span>}
            </div>
            {o.readyAt && o.status !== "READY" && !finished(o) && (
              <div className="order-foot" style={{ justifyContent: "flex-start", gap: 6 }}>
                <Clock size={14} /> Listo {formatWhen(o.readyAt).toLowerCase()}
              </div>
            )}
          </Link>
        ))}
      </main>
    </>
  );
}
