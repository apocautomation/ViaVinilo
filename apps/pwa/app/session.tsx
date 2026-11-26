"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, createApiClient } from "@viavinilo/api-client";
import type { AppCustomer } from "@viavinilo/contracts";

/** API de la app de clientes (D-038). En producción es `/api` del mismo dominio. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
/** WhatsApp de la empresa (link wa.me). Vacío mientras no se tenga el número (D-038). */
export const SUPPORT_WHATSAPP_URL = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL ?? "";

export { ApiError };

/** La sesión vencida la maneja SessionGate: acá no se redirige. */
export const { api, upload, downloadFile, getToken, saveToken, clearToken } = createApiClient({ baseUrl: API_URL, tokenKey: "vv.app.token" });

const SessionContext = createContext<{ me: AppCustomer; logout: () => void } | null>(null);

/** Datos del cliente con sesión iniciada. Solo dentro de las pantallas de (app). */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionGate");
  return ctx;
}

/** Sin sesión válida manda a /ingresar. Si bloquean al cliente, la sesión se corta al instante. */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<AppCustomer | null>(null);
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/ingresar");
      return;
    }
    setFailed("");
    api<AppCustomer>("/app/me")
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          clearToken();
          router.replace("/ingresar");
          return;
        }
        // Sin conexión o el sistema caído: avisar en vez de quedar en blanco.
        setFailed(e instanceof Error ? e.message : "No pudimos cargar tus datos.");
      });
  }, [router, attempt]);

  if (failed) {
    return (
      <main className="screen splash-error">
        <p>{failed}</p>
        <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
          Probar de nuevo
        </button>
      </main>
    );
  }
  if (!me) return <div className="splash" aria-busy="true" />;

  const logout = () => {
    clearToken();
    router.replace("/ingresar");
  };
  return <SessionContext.Provider value={{ me, logout }}>{children}</SessionContext.Provider>;
}
