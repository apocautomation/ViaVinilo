"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MailCheck, Send } from "lucide-react";
import { api } from "../../session";

/**
 * El link que difunde Via Vinilo (D-049): el cliente pone su email y le llega un mail con un link
 * para crear su contraseña. Siempre se responde lo mismo, sea o no el email de un cliente.
 */
export default function ActivarPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/app/auth/activation/request", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos mandar el mail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
      {sent ? (
        <>
          <div className="done-ico">
            <MailCheck size={34} aria-hidden />
          </div>
          <h1>Revisá tu mail</h1>
          <p className="lead">
            Si <strong>{email.trim().toLowerCase()}</strong> está en tu ficha de cliente, en unos minutos te llega un mail con
            un link para crear tu contraseña. Vale 48 horas. Revisá también spam.
          </p>
          <Link href="/ingresar" className="btn btn-primary btn-block">
            Ir a ingresar
          </Link>
        </>
      ) : (
        <>
          <h1>Creá tu contraseña</h1>
          <p className="lead">Poné el email con el que trabajás con Via Vinilo y te mandamos un link.</p>
          <form onSubmit={submit}>
            <label className="field">
              Tu email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              <Send size={18} /> {busy ? "Enviando…" : "Mandame el link"}
            </button>
          </form>
          <p className="auth-foot">
            ¿Ya tenés contraseña? <Link href="/ingresar">Ingresá</Link>
          </p>
        </>
      )}
    </main>
  );
}
