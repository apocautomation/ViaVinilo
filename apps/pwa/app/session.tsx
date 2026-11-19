"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** API de la app de clientes (D-038). En producción es `/api` del mismo dominio. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
/** WhatsApp de la empresa (link wa.me). Vacío mientras no se tenga el número (D-038). */
export const SUPPORT_WHATSAPP_URL = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL ?? "";

const TOKEN_KEY = "vv.app.token";

export interface Me {
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  emails: { email: string; isPrimary: boolean }[];
  phones: { phone: string; isPrimary: boolean }[];
  notificationPrefs: { push: boolean; email: boolean };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const getToken = () => storage()?.getItem(TOKEN_KEY) ?? null;
export const saveToken = (token: string) => storage()?.setItem(TOKEN_KEY, token);
export const clearToken = () => storage()?.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("No hay conexión. Revisá internet y probá de nuevo.", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; errors?: Record<string, string> };
    const first = body.errors ? Object.values(body.errors)[0] : undefined;
    const message = first ?? (Array.isArray(body.message) ? body.message[0] : body.message);
    throw new ApiError(message ?? "Algo salió mal. Probá de nuevo.", res.status);
  }
  return (await res.json()) as T;
}

/** +5493874669944 → 387 466-9944 */
export function formatPhone(phone: string): string {
  const m = /^\+549(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `${m[1]} ${m[2]}-${m[3]}` : phone;
}

const SessionContext = createContext<{ me: Me; logout: () => void } | null>(null);

/** Datos del cliente con sesión iniciada. Solo dentro de las pantallas de (app). */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionGate");
  return ctx;
}

/** Sin sesión válida manda a /ingresar. Si bloquean al cliente, la sesión se corta al instante. */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/ingresar");
      return;
    }
    api<Me>("/app/me")
      .then(setMe)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          clearToken();
          router.replace("/ingresar");
        }
      });
  }, [router]);

  if (!me) return <div className="splash" aria-busy="true" />;

  const logout = () => {
    clearToken();
    router.replace("/ingresar");
  };
  return <SessionContext.Provider value={{ me, logout }}>{children}</SessionContext.Provider>;
}
