"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronRight, LogOut, Mail, Phone, Smartphone } from "lucide-react";
import { AppBar } from "../../components";
import { formatPhone, useSession } from "../../session";

/** Cuenta: datos, avisos y puntos (E4). Los datos personales los cambia un asesor (actualización §2.1). */
export default function CuentaPage() {
  const { me, logout } = useSession();
  // TODO(spec): guardar los avisos desde la app (hoy los cambia un asesor en el ERP).
  const [push, setPush] = useState(me.notificationPrefs.push);
  const [mail, setMail] = useState(me.notificationPrefs.email);
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
  const initials = [me.firstName, me.lastName].map((n) => n?.[0] ?? "").join("").toUpperCase();

  return (
    <>
      <AppBar title="Mi cuenta" />
      <main className="screen">
        <section className="card profile">
          <span className="avatar">{initials || "VV"}</span>
          <div>
            <strong style={{ fontSize: 17 }}>{name}</strong>
            {me.businessName && (
              <div className="muted" style={{ fontSize: 13.5 }}>
                {me.businessName}
              </div>
            )}
            <span className="client-num">Cliente N.º {me.customerNumber}</span>
          </div>
        </section>

        <div className="points">
          <div>
            <span>Mis puntos</span>
            <b style={{ display: "block" }}>—</b>
          </div>
          <span className="preview-chip">Etapa 4</span>
        </div>

        <h2 className="section-title">Mis datos</h2>
        <section className="card">
          {me.emails.map((e) => (
            <div key={e.email} className="list-link">
              <span className="list-ico">
                <Mail size={18} />
              </span>
              <span>{e.email}</span>
            </div>
          ))}
          {me.phones.map((p) => (
            <div key={p.phone} className="list-link">
              <span className="list-ico">
                <Phone size={18} />
              </span>
              <span>{formatPhone(p.phone)}</span>
            </div>
          ))}
          <Link href="/ayuda/asistente" className="list-link">
            <span className="list-ico">
              <ChevronRight size={18} />
            </span>
            <span>Pedir un cambio de datos</span>
          </Link>
        </section>

        <h2 className="section-title">Avisos</h2>
        <section className="card">
          <div className="list-link">
            <span className="list-ico">
              <Smartphone size={18} />
            </span>
            <span>Notificaciones en el celular</span>
            <button className="switch" role="switch" aria-checked={push} aria-label="Notificaciones" onClick={() => setPush(!push)} />
          </div>
          <div className="list-link">
            <span className="list-ico">
              <Bell size={18} />
            </span>
            <span>Avisos por mail</span>
            <button className="switch" role="switch" aria-checked={mail} aria-label="Avisos por mail" onClick={() => setMail(!mail)} />
          </div>
        </section>

        <button className="btn btn-ghost btn-block" onClick={logout}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </main>
    </>
  );
}
