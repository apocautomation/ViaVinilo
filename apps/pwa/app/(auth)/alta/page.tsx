"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Clock } from "lucide-react";

/**
 * Pedido de alta de cliente nuevo: queda pendiente hasta que lo valida un asesor
 * (actualización §2.1, D-014). Datos mínimos: nombre, apellido, DNI, email y teléfono.
 */
export default function AltaPage() {
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <main className="shell auth" style={{ justifyContent: "center" }}>
        <span className="done-ico" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
          <Clock size={36} />
        </span>
        <h1>Recibimos tu pedido de alta</h1>
        <p className="lead">Un asesor lo revisa y te avisamos por mail cuando tu cuenta esté activa.</p>
        <Link href="/ingresar" className="btn btn-ghost btn-block">
          Volver
        </Link>
      </main>
    );
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" style={{ width: 200 }} />
      <h1>Alta de cliente</h1>
      <form onSubmit={submit}>
        <div className="row">
          <label className="field">
            Nombre
            <input autoComplete="given-name" required />
          </label>
          <label className="field">
            Apellido
            <input autoComplete="family-name" required />
          </label>
        </div>
        <label className="field">
          DNI
          <input inputMode="numeric" pattern="[0-9.]{7,10}" required />
        </label>
        <label className="field">
          Email
          <input type="email" inputMode="email" autoComplete="email" required />
        </label>
        <label className="field">
          Celular
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="387 …" required />
        </label>
        <label className="field">
          Empresa o marca <small>(opcional)</small>
          <input autoComplete="organization" />
        </label>
        <button className="btn btn-primary btn-block">Pedir el alta</button>
      </form>
      <p className="auth-foot">
        ¿Ya sos cliente? <Link href="/ingresar">Ingresá</Link>
      </p>
    </main>
  );
}
