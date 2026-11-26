"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, homeFor, saveSession, type SessionUser } from "./lib/api";

/**
 * Entrar al ERP: manda el formulario a `path`, guarda la sesión y lleva a la pantalla de inicio del rol.
 * Si falla, muestra el error y deja volver a intentar.
 */
export function useStartSession(path: string, fallbackError: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: SessionUser }>(path, { method: "POST", body: JSON.stringify(body) });
      saveSession(res.accessToken, res.user);
      router.replace(homeFor(res.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
      setBusy(false);
    }
  }

  return { error, setError, busy, start };
}

/** Pantalla de ingreso y de creación de contraseña: la marca a la izquierda y el formulario a la derecha. */
export function AuthScreen({
  side,
  title,
  sub,
  error,
  busy,
  submitLabel,
  busyLabel,
  onSubmit,
  children,
}: {
  /** Título, texto y lo que siga en el panel de la marca. */
  side: ReactNode;
  title: string;
  sub: string;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <main className="login">
      <section className="login-side">
        <img src="/logo-isotipo-blanco.svg" alt="Via Vinilo · Mayorista gráfico" />
        <div>{side}</div>
        <small style={{ color: "rgb(255 255 255 / 0.5)" }}>Mayorista gráfico · Salta</small>
      </section>
      <div className="login-form-wrap">
        <form onSubmit={onSubmit}>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
          {children}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-big" disabled={busy}>
            {busy ? busyLabel : submitLabel}
          </button>
        </form>
      </div>
    </main>
  );
}
