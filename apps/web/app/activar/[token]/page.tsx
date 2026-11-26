"use client";

import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { AuthScreen, useStartSession } from "../../auth-screen";

/**
 * Crear la contraseña del ERP con el link de la invitación (D-114). Sirve una sola vez y vence a las 72
 * horas; al crearla entra directo.
 */
export default function ActivarPage() {
  const { token } = useParams<{ token: string }>();
  const { error, setError, busy, start } = useStartSession("/auth/activate", "No pudimos crear la contraseña");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("repeat") ?? "")) {
      setError("Las dos contraseñas no coinciden");
      return;
    }
    void start({ token, password });
  }

  return (
    <AuthScreen
      side={
        <>
          <h2>Bienvenido al sistema de Via Vinilo</h2>
          <p>Tableros de producción, pedidos y clientes, conectado con la app de clientes.</p>
        </>
      }
      title="Creá tu contraseña"
      sub="La vas a usar para entrar con tu email. Solo la sabés vos."
      error={error}
      busy={busy}
      submitLabel="Crear contraseña y entrar"
      busyLabel="Guardando…"
      onSubmit={submit}
    >
      <label className="field">
        Contraseña
        <input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus placeholder="Mínimo 10 caracteres" />
      </label>
      <label className="field">
        Repetila
        <input name="repeat" type="password" autoComplete="new-password" minLength={10} required />
      </label>
    </AuthScreen>
  );
}
