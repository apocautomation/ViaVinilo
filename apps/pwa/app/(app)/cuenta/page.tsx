"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronRight, LogOut, Mail, Phone, Smartphone } from "lucide-react";
import { AppBar } from "../../components";
import { CUSTOMER } from "../../data";

/** Cuenta: datos, avisos y puntos (E4). Los datos personales los cambia un asesor (actualización §2.1). */
export default function CuentaPage() {
  const [push, setPush] = useState(true);
  const [mail, setMail] = useState(true);

  return (
    <>
      <AppBar title="Mi cuenta" />
      <main className="screen">
        <section className="card profile">
          <span className="avatar">JP</span>
          <div>
            <strong style={{ fontSize: 17 }}>{CUSTOMER.contact}</strong>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {CUSTOMER.name}
            </div>
            <span className="client-num">Cliente N.º {CUSTOMER.number}</span>
          </div>
        </section>

        <div className="points">
          <div>
            <span>Mis puntos</span>
            <b style={{ display: "block" }}>{CUSTOMER.points.toLocaleString("es-AR")}</b>
          </div>
          <span className="preview-chip">Etapa 4</span>
        </div>

        <h2 className="section-title">Mis datos</h2>
        <section className="card">
          <div className="list-link">
            <span className="list-ico">
              <Mail size={18} />
            </span>
            <span>juan@remeras.test</span>
          </div>
          <div className="list-link">
            <span className="list-ico">
              <Phone size={18} />
            </span>
            <span>+54 9 387 000-0000</span>
          </div>
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

        <Link href="/ingresar" className="btn btn-ghost btn-block">
          <LogOut size={18} /> Cerrar sesión
        </Link>
      </main>
    </>
  );
}
