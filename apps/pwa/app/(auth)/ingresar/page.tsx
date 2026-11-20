"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { api, getToken, saveToken, SUPPORT_WHATSAPP_URL } from "../../session";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Si ya hay sesión, directo a sus pedidos.
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { accessToken } = await api<{ accessToken: string }>("/app/auth/login", {
        method: "POST",
        body: JSON.stringify({ user, password }),
      });
      saveToken(accessToken);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
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
          <span className="password-row">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
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
    </main>
  );
}
