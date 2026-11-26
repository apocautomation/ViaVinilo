"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Pantallas sin sesión (ingresar y crear la contraseña): el logo arriba y el contenido abajo. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
      {children}
    </main>
  );
}

/** Campo de contraseña con el ojito para verla. */
export function PasswordInput({ show, onToggle, ...input }: { show: boolean; onToggle: () => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className="password-row">
      <input {...input} type={show ? "text" : "password"} />
      <button type="button" className="icon-btn" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={onToggle}>
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </span>
  );
}

/**
 * Manda un formulario y lleva el estado del botón y del error. Si sale bien, el botón queda ocupado
 * mientras la pantalla cambia; si falla, muestra el mensaje y deja volver a intentar.
 */
export function useAuthSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, fallbackError: string) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
