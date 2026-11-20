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

/**
 * Sube un archivo con barra de progreso (D-062). Usa XMLHttpRequest porque fetch no informa el avance.
 */
export function upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError("No hay conexión. Revisá internet y probá de nuevo.", 0));
    xhr.onload = () => {
      let body: { message?: string | string[]; errors?: Record<string, string> } & Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* respuesta vacía */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
      if (xhr.status === 413) return reject(new ApiError("El archivo es muy grande: el máximo es 150 MB.", 413));
      const first = body.errors ? Object.values(body.errors)[0] : undefined;
      const message = first ?? (Array.isArray(body.message) ? body.message[0] : body.message);
      reject(new ApiError(message ?? "No pudimos subir el archivo. Probá de nuevo.", xhr.status));
    };
    xhr.send(form);
  });
}

/** Descarga un archivo con la sesión (un link común no manda el token) y lo guarda con su nombre. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(body.message ?? "No pudimos descargar el archivo.", res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/ingresar");
      return;
    }
    setFailed("");
    api<Me>("/app/me")
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
