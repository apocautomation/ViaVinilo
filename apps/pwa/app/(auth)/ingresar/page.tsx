"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Mail } from "lucide-react";
import { api, getToken, saveToken, SUPPORT_WHATSAPP_URL } from "../../session";

const RESEND_SECONDS = 60;

/** Para los que todavía no son clientes: no hay autoalta, se escribe por WhatsApp (D-038). */
function NotClientYet() {
  return (
    <p className="auth-foot">
      ¿Todavía no sos cliente?{" "}
      {SUPPORT_WHATSAPP_URL ? (
        <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          Escribinos por WhatsApp
        </a>
      ) : (
        <span>Escribinos por WhatsApp</span>
      )}{" "}
      y un asesor te da de alta.
    </p>
  );
}

/** Ingreso sin contraseña: código de 6 números a uno de los emails de la ficha (D-016, D-038). */
export default function IngresarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Si ya hay sesión, directo a sus pedidos.
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function requestCode() {
    setEmail((e) => e.trim().toLowerCase());
    setBusy(true);
    setError("");
    try {
      await api("/app/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
      setStep("code");
      setWait(RESEND_SECONDS);
      inputs.current.forEach((el) => el && (el.value = ""));
      setTimeout(() => inputs.current[0]?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos mandar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    setBusy(true);
    setError("");
    try {
      const { accessToken } = await api<{ accessToken: string }>("/app/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      saveToken(accessToken);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "El código no es válido.");
      inputs.current.forEach((el) => el && (el.value = ""));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  const tryVerify = () => {
    const code = inputs.current.map((x) => x?.value ?? "").join("");
    if (code.length === 6) void verify(code);
  };

  /** Reparte los números desde la casilla `from`: sirve para tipear, pegar o el autocompletado del celular. */
  function fill(from: number, digits: string) {
    digits
      .slice(0, 6 - from)
      .split("")
      .forEach((d, k) => {
        const el = inputs.current[from + k];
        if (el) el.value = d;
      });
    inputs.current[Math.min(from + digits.length, 5)]?.focus();
    tryVerify();
  }

  function onDigit(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) return fill(i, digits);
    const el = inputs.current[i];
    if (el) el.value = digits;
    if (digits && i < 5) inputs.current[i + 1]?.focus();
    tryVerify();
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !e.currentTarget.value && i > 0) inputs.current[i - 1]?.focus();
  }

  /** Pegar el código entero (o que el celular lo complete solo) llena las 6 casillas. */
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length < 2) return;
    e.preventDefault();
    fill(0, digits);
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
      {step === "email" ? (
        <>
          <h1>Seguí tus trabajos</h1>
          <p className="lead">Estado, precio y cuándo podés retirar cada pedido.</p>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void requestCode();
            }}
          >
            <label className="field">
              Tu email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              <Mail size={18} /> {busy ? "Enviando…" : "Recibir código"}
            </button>
          </form>
          <NotClientYet />
        </>
      ) : (
        <>
          <h1>Revisá tu mail</h1>
          <p className="lead">
            Si <strong>{email}</strong> está cargado en tu ficha de cliente, te llega un código de 6 números. Vence en 10
            minutos.
          </p>
          <div className="otp">
            {Array.from({ length: 6 }, (_, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                aria-label={`Dígito ${i + 1}`}
                readOnly={busy}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
              />
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              setStep("email");
              setError("");
            }}
          >
            Usar otro email
          </button>
          <p className="auth-foot">
            ¿No llegó? Revisá spam o{" "}
            {wait > 0 ? (
              <span className="muted">pedí otro en {wait} s</span>
            ) : (
              <button className="link-btn" onClick={() => void requestCode()} disabled={busy}>
                pedí otro código
              </button>
            )}
            .
          </p>
        </>
      )}
    </main>
  );
}
