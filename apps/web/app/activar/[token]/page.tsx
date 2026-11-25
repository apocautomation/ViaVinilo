"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, homeFor, saveSession, type SessionUser } from "../../lib/api";

/**
 * Crear la contraseña del ERP con el link de la invitación (D-114). Sirve una sola vez y vence a las 72
 * horas; al crearla entra directo.
 */
export default function ActivarPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("repeat") ?? "")) {
      setError("Las dos contraseñas no coinciden");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: SessionUser }>("/auth/activate", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      saveSession(res.accessToken, res.user);
      router.replace(homeFor(res.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la contraseña");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-side">
        <img src="/logo-isotipo-blanco.svg" alt="Via Vinilo · Mayorista gráfico" />
        <div>
          <h2>Bienvenido al sistema de Via Vinilo</h2>
          <p>Tableros de producción, pedidos y clientes, conectado con la app de clientes.</p>
        </div>
        <small style={{ color: "rgb(255 255 255 / 0.5)" }}>Mayorista gráfico · Salta</small>
      </section>
      <div className="login-form-wrap">
        <form onSubmit={submit}>
          <h1>Creá tu contraseña</h1>
          <p className="sub">La vas a usar para entrar con tu email. Solo la sabés vos.</p>
          <label className="field">
            Contraseña
            <input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus placeholder="Mínimo 10 caracteres" />
          </label>
          <label className="field">
            Repetila
            <input name="repeat" type="password" autoComplete="new-password" minLength={10} required />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-big" disabled={busy}>
            {busy ? "Guardando…" : "Crear contraseña y entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
