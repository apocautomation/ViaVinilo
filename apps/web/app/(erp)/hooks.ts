"use client";

import { useEffect, useState } from "react";
import { api, ApiError, getUser } from "../lib/api";

/** El mensaje de un error para mostrarlo en pantalla. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");

/** El valor recién cuando dejan de cambiarlo por `ms`: las búsquedas no piden en cada tecla. */
export function useDebounced(value: string, ms = 350): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Pide `path` a la API cada vez que cambia (o cambia `reloadKey`). Con `path` en null no pide nada.
 * Si llega una respuesta vieja después de una nueva, se descarta.
 */
export function useApiQuery<T>(path: string | null, fallbackError: string, reloadKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setError("");
    api<T>(path)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : fallbackError));
    return () => {
      cancelled = true;
    };
  }, [path, fallbackError, reloadKey]);
  return { data, error };
}

/** Si quien entró es el dueño. Es null hasta montar: en el servidor no hay sesión y el primer dibujo tiene que coincidir. */
export function useIsOwner(): boolean | null {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  useEffect(() => setIsOwner(getUser()?.roles.includes("OWNER") ?? false), []);
  return isOwner;
}
