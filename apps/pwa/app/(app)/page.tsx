"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, PackageCheck } from "lucide-react";
import { AppBar, PushPrompt, StatusPill, StepsBar } from "../components";
import { ORDERS, ars } from "../data";
import { useSession } from "../session";

/** Mis pedidos: lo primero que ve el cliente al abrir la app (D-034). */
export default function PedidosPage() {
  const { me } = useSession();
  const [tab, setTab] = useState<"curso" | "entregados">("curso");
  const active = ORDERS.filter((o) => o.status !== "DELIVERED");
  const list = tab === "curso" ? active : ORDERS.filter((o) => o.status === "DELIVERED");
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

        {list.length === 0 && (
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
              {o.amount ? <b>{ars.format(o.amount)}</b> : <span>Sin cotizar</span>}
            </div>
            {o.readyAt && o.status !== "READY" && o.status !== "DELIVERED" && (
              <div className="order-foot" style={{ justifyContent: "flex-start", gap: 6 }}>
                <Clock size={14} /> Listo {o.readyAt.toLowerCase()}
              </div>
            )}
          </Link>
        ))}
      </main>
    </>
  );
}
