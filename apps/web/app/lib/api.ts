"use client";

/** Cliente de la API para el backoffice. El token del personal vive en localStorage. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "vv.token";
const USER_KEY = "vv.user";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: ("OWNER" | "PRODUCTION" | "ATTENTION")[];
}

/** Producción entra directo a su tablero; dueño y atención, al inicio. */
export function homeFor(user: SessionUser): string {
  return user.roles.includes("OWNER") || user.roles.includes("ATTENTION") ? "/inicio" : "/produccion";
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function getUser(): SessionUser | null {
  try {
    const raw = storage()?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  storage()?.setItem(TOKEN_KEY, token);
  storage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  storage()?.removeItem(TOKEN_KEY);
  storage()?.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401) {
    clearSession();
    if (!location.pathname.startsWith("/login")) location.href = "/login";
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; errors?: Record<string, string> };
    const first = body.errors ? Object.values(body.errors)[0] : undefined;
    const message = first ?? (Array.isArray(body.message) ? body.message[0] : body.message) ?? "Algo salió mal. Probá de nuevo.";
    throw new ApiError(message ?? "Error", res.status, body.errors);
  }
  if (res.status === 204) return undefined as T;
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

/**
 * Escucha los cambios del tablero de un sector (SSE de la API) con fetch, para poder mandar el token.
 * Llama a `onChange` cada vez que cambia algo. Si se corta, reintenta solo. Devuelve la función para cortar.
 */
export function watchBoard(sector: string, onChange: () => void, onStatus: (live: boolean) => void): () => void {
  const ctrl = new AbortController();
  let stopped = false;

  const connect = async () => {
    while (!stopped) {
      try {
        const res = await fetch(`${API_URL}/jobs/board/stream?sector=${sector}`, {
          headers: { Authorization: `Bearer ${getToken() ?? ""}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        onStatus(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let first = true;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            if (!block.split("\n").includes("event: changed")) continue;
            // El primer aviso es el estado actual: el tablero ya está cargado.
            if (first) first = false;
            else onChange();
          }
        }
      } catch {
        if (stopped) return;
      }
      onStatus(false);
      await new Promise((r) => setTimeout(r, 3000));
    }
  };
  void connect();

  return () => {
    stopped = true;
    ctrl.abort();
  };
}
