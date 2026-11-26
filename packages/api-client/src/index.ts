/**
 * Cliente HTTP de la API para el ERP y la app de clientes. Cada frontend crea el suyo con su clave
 * de token y decide qué hacer cuando la sesión vence.
 */

const OFFLINE = "No hay conexión. Revisá internet y probá de nuevo.";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Cuerpo de error de la API: un mensaje, una lista de mensajes o errores por campo. */
export interface ErrorBody {
  message?: string | string[];
  errors?: Record<string, string>;
}

/** El texto que se le muestra a la persona: el primer error de campo, si no el mensaje, si no `fallback`. */
export function errorMessage(body: ErrorBody, fallback: string): string {
  const first = body.errors ? Object.values(body.errors)[0] : undefined;
  return first ?? (Array.isArray(body.message) ? body.message[0] : body.message) ?? fallback;
}

/** localStorage, o null si el navegador no lo deja usar (modo privado, permisos). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Clave de localStorage donde vive el token de la sesión. */
  tokenKey: string;
  /** Se llama cuando la API responde 401, antes de lanzar el error. */
  on401?: () => void;
}

export function createApiClient({ baseUrl, tokenKey, on401 }: ApiClientOptions) {
  const getToken = (): string | null => browserStorage()?.getItem(tokenKey) ?? null;
  const saveToken = (token: string) => browserStorage()?.setItem(tokenKey, token);
  const clearToken = () => browserStorage()?.removeItem(tokenKey);
  const authHeader = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...authHeader(), ...init.headers },
      });
    } catch {
      throw new ApiError(OFFLINE, 0);
    }
    if (res.status === 401) on401?.();
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ErrorBody;
      throw new ApiError(errorMessage(body, "Algo salió mal. Probá de nuevo."), res.status, body.errors);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Sube un archivo con barra de progreso (D-062). Usa XMLHttpRequest porque fetch no informa el avance. */
  function upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}${path}`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError(OFFLINE, 0));
      xhr.onload = () => {
        let body: ErrorBody & Record<string, unknown> = {};
        try {
          body = JSON.parse(xhr.responseText || "{}");
        } catch {
          /* respuesta vacía */
        }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body as T);
        if (xhr.status === 413)
          return reject(new ApiError("El archivo es muy grande: el máximo es 150 MB.", 413));
        reject(
          new ApiError(
            errorMessage(body, "No pudimos subir el archivo. Probá de nuevo."),
            xhr.status,
            body.errors,
          ),
        );
      };
      xhr.send(form);
    });
  }

  /** Descarga un archivo con la sesión (un link común no manda el token) y lo guarda con su nombre. */
  async function downloadFile(path: string, filename: string): Promise<void> {
    const res = await fetch(`${baseUrl}${path}`, { headers: authHeader() });
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

  return { getToken, saveToken, clearToken, api, upload, downloadFile };
}
