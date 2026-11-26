"use client";

import { ApiError, browserStorage, createApiClient } from "@viavinilo/api-client";
import type { SessionUser } from "@viavinilo/contracts";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type { SessionUser };

const USER_KEY = "vv.user";

/** Producción entra directo a su tablero; dueño y atención, al inicio. */
export function homeFor(user: SessionUser): string {
  return user.roles.includes("OWNER") || user.roles.includes("ATTENTION") ? "/inicio" : "/produccion";
}

/** Cliente de la API para el backoffice. El token del personal vive en localStorage. */
export const { api, upload, downloadFile, getToken, saveToken, clearToken } = createApiClient({
  baseUrl: API_URL,
  tokenKey: "vv.token",
  on401: () => {
    clearSession();
    // D-114: en /activar el 401 es "el link venció": se muestra ahí, no se manda al login.
    if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/activar")) location.href = "/login";
  },
});

export { ApiError };

export function getUser(): SessionUser | null {
  try {
    const raw = browserStorage()?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  saveToken(token);
  browserStorage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  clearToken();
  browserStorage()?.removeItem(USER_KEY);
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
