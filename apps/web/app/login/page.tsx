"use client";

import type { FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { AuthScreen, useStartSession } from "../auth-screen";

export default function LoginPage() {
  const { error, busy, start } = useStartSession("/auth/login", "No pudimos iniciar sesión");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void start({ email: form.get("email"), password: form.get("password") });
  }

  return (
    <AuthScreen
      side={
        <>
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
        </>
      }
      title="Ingresá a tu cuenta"
      sub="Usá tu email y tu contraseña. Si todavía no la creaste, buscá el mail «Tu acceso al sistema»."
      error={error}
      busy={busy}
      submitLabel="Entrar"
      busyLabel="Entrando…"
      onSubmit={submit}
    >
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
    </AuthScreen>
  );
}
