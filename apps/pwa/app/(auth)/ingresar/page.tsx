"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { api, getToken, saveToken, SUPPORT_WHATSAPP_URL } from "../../session";
import { AuthShell, PasswordInput, useAuthSubmit } from "../auth-parts";

/** "Escribinos por WhatsApp", con link solo si ya está cargado el número de la empresa (D-039). */
function WhatsApp({ children }: { children: string }) {
  return SUPPORT_WHATSAPP_URL ? (
    <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

/**
 * Ingreso con email o celular y contraseña (D-039, D-049). La primera vez (o si se la olvidó) el
 * cliente crea su contraseña en /activar con un link que le llega al mail. No hay autoalta (D-038).
 */
export default function IngresarPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const { busy, error, run } = useAuthSubmit();

  // Si ya hay sesión, directo a sus pedidos.
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const { accessToken } = await api<{ accessToken: string }>("/app/auth/login", {
        method: "POST",
        body: JSON.stringify({ user, password }),
      });
      saveToken(accessToken);
      router.replace("/");
    }, "No pudimos iniciar sesión.");
  }

  return (
    <AuthShell>
      <h1>Seguí tus trabajos</h1>
      <p className="lead">Estado, precio y cuándo podés retirar cada pedido.</p>
      <form onSubmit={submit}>
        <label className="field">
          Email o celular
          <input
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="tu@email.com o 387 412-3456"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Contraseña
          <PasswordInput show={show} onToggle={() => setShow((s) => !s)} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          <LogIn size={18} /> {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <Link href="/activar" className="btn btn-ghost btn-block">
        ¿Primera vez o te olvidaste la contraseña? Creala acá
      </Link>
      <p className="auth-foot">
        ¿Todavía no sos cliente o no tenés email cargado? <WhatsApp>Escribinos por WhatsApp</WhatsApp> y un asesor
        te ayuda.
      </p>
    </AuthShell>
  );
}
