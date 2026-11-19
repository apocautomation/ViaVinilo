"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, homeFor, saveSession, type SessionUser } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      saveSession(res.accessToken, res.user);
      router.replace(homeFor(res.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesión");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-side">
        <img src="/logo-isotipo-blanco.svg" alt="Via Vinilo · Mayorista gráfico" />
        <div>
          <h2>Gestión integral de Via Vinilo</h2>
          <p>Ventas, producción y administración en un solo lugar, conectado con la app de clientes.</p>
          <ul>
            <li>
              <CheckCircle2 size={18} /> Pedidos y conversaciones de la app
            </li>
            <li>
              <CheckCircle2 size={18} /> Tableros de producción por sector
            </li>
            <li>
              <CheckCircle2 size={18} /> Facturación ARCA, cobros y libros de IVA
            </li>
          </ul>
        </div>
        <small style={{ color: "rgb(255 255 255 / 0.5)" }}>Mayorista gráfico · Salta</small>
      </section>
      <div className="login-form-wrap">
        <form onSubmit={submit}>
          <h1>Ingresá a tu cuenta</h1>
          <p className="sub">Usá el email y la contraseña que te dio el dueño.</p>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label className="field">
            Contraseña
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-big" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
