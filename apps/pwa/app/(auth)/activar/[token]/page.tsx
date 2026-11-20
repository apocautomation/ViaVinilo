"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { api, saveToken } from "../../../session";

/** El cliente llega desde el link del mail y crea su contraseña (D-049). Queda con la sesión iniciada. */
export default function CrearClavePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    if (password !== repeat) return setError("Las dos contraseñas no coinciden.");
    setBusy(true);
    try {
      const { accessToken } = await api<{ accessToken: string }>("/app/auth/activation/complete", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      saveToken(accessToken);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la contraseña.");
      setBusy(false);
    }
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
      <h1>Creá tu contraseña</h1>
      <p className="lead">Después vas a entrar con tu email o tu celular y esta contraseña.</p>
      <form onSubmit={submit}>
        <label className="field">
          Contraseña nueva
          <span className="password-row">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
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
          <small>Mínimo 8 caracteres.</small>
        </label>
        <label className="field">
          Repetila
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          <KeyRound size={18} /> {busy ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
      <p className="auth-foot">
        ¿El link venció? <Link href="/activar">Pedí uno nuevo</Link>
      </p>
    </main>
  );
}
