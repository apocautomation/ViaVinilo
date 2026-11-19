"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";

/**
 * Ingreso sin contraseña: código de 6 dígitos al email (D-016). Pantalla visual (D-034);
 * la API de OTP se conecta en el paso 6.
 */
export default function IngresarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function sendCode(e: FormEvent) {
    e.preventDefault();
    setStep("code");
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }

  function onDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const el = inputs.current[i];
    if (el) el.value = d;
    if (d && i < 5) inputs.current[i + 1]?.focus();
    if (inputs.current.every((x) => x?.value)) router.push("/");
  }

  return (
    <main className="shell auth">
      <img className="auth-logo" src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" />
      {step === "email" ? (
        <>
          <h1>Seguí tus trabajos</h1>
          <p className="lead">Estado, precio y cuándo podés retirar cada pedido.</p>
          <form onSubmit={sendCode}>
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
            <button className="btn btn-primary btn-block">
              <Mail size={18} /> Recibir código
            </button>
          </form>
          <p className="auth-foot">
            ¿Todavía no sos cliente? <Link href="/alta">Pedí el alta</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Revisá tu mail</h1>
          <p className="lead">
            Te mandamos un código de 6 números a <strong>{email}</strong>.
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
                maxLength={1}
                aria-label={`Dígito ${i + 1}`}
                onChange={(e) => onDigit(i, e.target.value)}
              />
            ))}
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => setStep("email")}>
            Usar otro email
          </button>
          <p className="auth-foot">
            ¿No llegó? <a href="#">Reenviar código</a>
          </p>
        </>
      )}
    </main>
  );
}
