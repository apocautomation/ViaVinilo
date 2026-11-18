"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, saveSession, type SessionUser } from "../lib/api";

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
      router.replace("/tablero");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesión");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/logo-isotipo.svg" alt="Via Vinilo · Mayorista gráfico" />
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
    </main>
  );
}
