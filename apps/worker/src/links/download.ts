/**
 * Descarga de archivos que el cliente mandó por un link (D-072). El servidor solo se conecta a las
 * direcciones de los servicios conocidos: cada salto de la descarga se revisa contra esa lista, así
 * un link armado a propósito no puede hacer que el servidor entre a otra parte.
 */
export type LinkProvider = "drive" | "onedrive";

export interface LinkTarget {
  provider: LinkProvider;
  /** Dirección de descarga directa. */
  url: string;
}

export interface DownloadedFile {
  filename: string;
  mime: string;
  content: Buffer;
}

/** Por qué no se pudo bajar. `private` y `too_big` se le explican al operador en la tarjeta. */
export type DownloadFailure = "private" | "not_found" | "too_big" | "not_a_file" | "error";
export type DownloadResult = { ok: true; file: DownloadedFile } | { ok: false; reason: DownloadFailure };

const ALLOWED_HOSTS: Record<LinkProvider, RegExp[]> = {
  drive: [/^drive\.google\.com$/, /^drive\.usercontent\.google\.com$/, /^docs\.google\.com$/, /^[a-z0-9-]+\.googleusercontent\.com$/],
  onedrive: [/^my\.microsoftpersonalcontent\.com$/, /^[a-z0-9-]+\.microsoftpersonalcontent\.com$/],
};
/** Si la descarga manda a iniciar sesión, el link no es público. */
const LOGIN_HOSTS = [/^accounts\.google\.com$/, /^login\.live\.com$/, /^login\.microsoftonline\.com$/];

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.port ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
};

export function isAllowedHost(provider: LinkProvider, url: string): boolean {
  const host = hostOf(url);
  return host !== null && ALLOWED_HOSTS[provider].some((re) => re.test(host));
}

/** Convierte el link que escribió el cliente en una descarga directa. null si no es de un archivo. */
export function linkTarget(link: string): LinkTarget | null {
  const host = hostOf(link);
  if (!host) return null;
  if (host === "drive.google.com" || host === "docs.google.com") {
    // Carpetas, formularios y documentos de Google no son un archivo para imprimir.
    const u = new URL(link);
    const id = /^\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(u.pathname)?.[1] ?? (/^\/(open|uc)$/.test(u.pathname) ? u.searchParams.get("id") : null);
    if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) return null;
    return { provider: "drive", url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` };
  }
  if (host === "1drv.ms") {
    // Link compartido de OneDrive personal: https://1drv.ms/<tipo>/c/<cuenta>/<clave>. Con esos dos datos
    // OneDrive entrega el archivo sin iniciar sesión (probado con links reales el 23/11/2026).
    const m = /^\/[a-z]\/c\/([0-9a-f]{8,32})\/([A-Za-z0-9_-]{10,200})$/i.exec(new URL(link).pathname);
    if (!m) return null;
    return { provider: "onedrive", url: `https://my.microsoftpersonalcontent.com/personal/${m[1]!.toLowerCase()}/_layouts/15/download.aspx?share=${m[2]}` };
  }
  return null;
}

/** Nombre que manda el servidor en "Content-Disposition", sin rutas ni caracteres raros. */
export function filenameFrom(header: string | null, fallback: string): string {
  let name: string | undefined;
  const star = header ? /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)?.[1] : undefined;
  if (star) {
    try {
      name = decodeURIComponent(star);
    } catch {
      name = undefined;
    }
  }
  name ??= header ? /filename\s*=\s*"([^"]+)"/.exec(header)?.[1] ?? /filename\s*=\s*([^;]+)/.exec(header)?.[1] : undefined;
  const clean = (name ?? "")
    .replace(/[\\/]/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150);
  return clean || fallback;
}

const MAX_REDIRECTS = 6;

/**
 * Baja el archivo siguiendo las redirecciones a mano: cada salto tiene que ser a un host permitido.
 * Corta si el archivo pasa el tamaño máximo.
 */
export async function downloadLink(
  target: LinkTarget,
  opts: { maxBytes: number; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<DownloadResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  let url = target.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedHost(target.provider, url)) {
        const host = hostOf(url);
        return { ok: false, reason: host && LOGIN_HOSTS.some((re) => re.test(host)) ? "private" : "error" };
      }
      const res = await doFetch(url, { redirect: "manual", signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000), headers: { "User-Agent": "ViaVinilo/1.0" } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!next) return { ok: false, reason: "error" };
        url = new URL(next, url).toString();
        continue;
      }
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "private" };
      if (res.status === 404 || res.status === 410) return { ok: false, reason: "not_found" };
      if (res.status !== 200) return { ok: false, reason: "error" };

      const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim().toLowerCase();
      // Una página web en vez del archivo: Drive muestra "necesitás permiso" o un aviso.
      if (mime === "text/html") {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, reason: target.provider === "drive" ? "private" : "not_a_file" };
      }
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > opts.maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, reason: "too_big" };
      }
      if (!res.body) return { ok: false, reason: "error" };
      const chunks: Buffer[] = [];
      let size = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > opts.maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "too_big" };
        }
        chunks.push(Buffer.from(value));
      }
      if (size === 0) return { ok: false, reason: "error" };
      return { ok: true, file: { filename: filenameFrom(res.headers.get("content-disposition"), "archivo"), mime, content: Buffer.concat(chunks) } };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
