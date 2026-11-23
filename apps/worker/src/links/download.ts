/**
 * Descarga de archivos que el cliente mandó por un link (D-072, D-076). El servidor solo se conecta
 * a las direcciones de los servicios conocidos: cada salto de la descarga se revisa contra esa
 * lista, así un link armado a propósito no puede hacer que el servidor entre a otra parte.
 */
export type LinkProvider = "drive" | "onedrive" | "wetransfer" | "dropbox";

export const PROVIDER_NAME: Record<LinkProvider, string> = { drive: "Google Drive", onedrive: "OneDrive", wetransfer: "WeTransfer", dropbox: "Dropbox" };

export interface LinkTarget {
  provider: LinkProvider;
  /** Dirección de descarga directa. */
  url: string;
}

/** El archivo abierto: se lee de a pedazos y se escribe directo al disco, sin cargarlo en memoria. */
export interface OpenedFile {
  filename: string;
  mime: string;
  /** Tamaño que avisó el servidor, si lo avisó. */
  declaredBytes: number | null;
  body: ReadableStream<Uint8Array>;
}

/** Por qué no se pudo bajar. Se le explica al operador en la tarjeta. */
export type DownloadFailure = "private" | "not_found" | "not_a_file" | "no_space" | "error";
export type OpenResult = { ok: true; file: OpenedFile } | { ok: false; reason: DownloadFailure };

const ALLOWED_HOSTS: Record<LinkProvider, RegExp[]> = {
  drive: [/^drive\.google\.com$/, /^drive\.usercontent\.google\.com$/, /^docs\.google\.com$/, /^[a-z0-9-]+\.googleusercontent\.com$/],
  onedrive: [/^my\.microsoftpersonalcontent\.com$/, /^[a-z0-9-]+\.microsoftpersonalcontent\.com$/],
  wetransfer: [/^we\.tl$/, /^wetransfer\.com$/, /^[a-z0-9-]+\.wetransfer\.com$/],
  dropbox: [/^(www\.)?dropbox\.com$/, /^[a-z0-9-]+\.dropboxusercontent\.com$/],
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

/**
 * Links que vienen en el pie de los mails de "compartido con vos" de Google ("denunciar abuso",
 * "bloquear usuario"): no son archivos y no se le avisan al operador.
 */
export function isNoiseLink(link: string): boolean {
  const host = hostOf(link);
  if (host !== "drive.google.com") return false;
  const path = new URL(link).pathname;
  return path === "/abuse" || path.startsWith("/drive/blockuser");
}

const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
const driveDownload = (id: string): LinkTarget => ({ provider: "drive", url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` });

/** Id de una carpeta de Drive, si el link es de una carpeta. */
export function driveFolderId(link: string): string | null {
  if (hostOf(link) !== "drive.google.com") return null;
  const id = /^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/.exec(new URL(link).pathname)?.[1];
  return id ?? null;
}

/** Convierte un link de un archivo en su descarga directa. null si hay que resolverlo en línea o no es un archivo. */
export function linkTarget(link: string): LinkTarget | null {
  const host = hostOf(link);
  if (!host) return null;
  const u = new URL(link);
  if (host === "drive.google.com" || host === "docs.google.com") {
    // Documentos y formularios de Google no son un archivo para imprimir; las carpetas se resuelven aparte.
    const id = /^\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(u.pathname)?.[1] ?? (/^\/(open|uc)$/.test(u.pathname) ? u.searchParams.get("id") : null);
    return id && DRIVE_ID.test(id) ? driveDownload(id) : null;
  }
  if (host === "1drv.ms") {
    // Link compartido de OneDrive personal: https://1drv.ms/<tipo>/c/<cuenta>/<clave>. Con esos dos datos
    // OneDrive entrega el archivo sin iniciar sesión (probado con links reales el 23/11/2026).
    const m = /^\/[a-z]\/c\/([0-9a-f]{8,32})\/([A-Za-z0-9_-]{10,200})$/i.exec(u.pathname);
    if (!m) return null;
    return { provider: "onedrive", url: `https://my.microsoftpersonalcontent.com/personal/${m[1]!.toLowerCase()}/_layouts/15/download.aspx?share=${m[2]}` };
  }
  if (host === "dropbox.com" || host === "www.dropbox.com") {
    // Un link compartido de Dropbox se baja directo con dl=1.
    if (!/^\/(s|scl\/fi|scl\/fo|sh)\//.test(u.pathname)) return null;
    u.searchParams.set("dl", "1");
    return { provider: "dropbox", url: u.toString() };
  }
  return null;
}

type Fetch = typeof fetch;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; ViaVinilo/1.0)" };

/** Pedido corto (no la descarga del archivo): corta a los 30 segundos. */
async function quick(doFetch: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  return doFetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { ...UA, ...(init.headers as Record<string, string> | undefined) } });
}

/** Archivos de una carpeta pública de Drive (solo los del primer nivel). */
async function driveFolderTargets(id: string, doFetch: Fetch): Promise<LinkTarget[] | DownloadFailure> {
  const res = await quick(doFetch, `https://drive.google.com/embeddedfolderview?id=${id}`);
  if (res.status >= 300 && res.status < 400) return "private";
  if (res.status === 404) return "not_found";
  if (res.status !== 200) return "error";
  const html = await res.text();
  const ids = new Set<string>();
  for (const m of html.matchAll(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/g)) ids.add(m[1]!);
  return ids.size ? [...ids].map(driveDownload) : "not_a_file";
}

/** WeTransfer: el link corto lleva a la página de la transferencia; su API entrega la descarga directa. */
async function wetransferTarget(link: string, doFetch: Fetch): Promise<LinkTarget[] | DownloadFailure> {
  let url = link;
  for (let hop = 0; hop < 4 && hostOf(url) === "we.tl"; hop++) {
    const res = await quick(doFetch, url);
    const next = res.headers.get("location");
    await res.body?.cancel().catch(() => undefined);
    if (res.status === 404) return "not_found";
    if (!next) return "error";
    url = new URL(next, url).toString();
  }
  if (!isAllowedHost("wetransfer", url)) return "error";
  const m = /^\/downloads\/([A-Za-z0-9]{10,80})\/([A-Za-z0-9]{4,40})$/.exec(new URL(url).pathname);
  if (!m) return "not_a_file";
  const res = await quick(doFetch, `https://wetransfer.com/api/v4/transfers/${m[1]}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body: JSON.stringify({ security_hash: m[2], intent: "entire_transfer" }),
  });
  // Las transferencias de WeTransfer vencen a los pocos días.
  if (res.status === 403 || res.status === 404 || res.status === 410) return "not_found";
  if (res.status !== 200) return "error";
  const direct = ((await res.json().catch(() => null)) as { direct_link?: unknown } | null)?.direct_link;
  return typeof direct === "string" && isAllowedHost("wetransfer", direct) ? [{ provider: "wetransfer", url: direct }] : "not_found";
}

/**
 * De un link que escribió el cliente, las descargas que hay que hacer. Un archivo da una; una carpeta
 * de Drive, una por archivo. `null`: no es de un servicio que se baje solo.
 */
export async function resolveLink(link: string, doFetch: Fetch = fetch): Promise<{ provider: LinkProvider; targets: LinkTarget[] } | { provider: LinkProvider; failure: DownloadFailure } | null> {
  const direct = linkTarget(link);
  if (direct) return { provider: direct.provider, targets: [direct] };
  const host = hostOf(link);
  try {
    const folder = driveFolderId(link);
    if (folder) {
      const r = await driveFolderTargets(folder, doFetch);
      return typeof r === "string" ? { provider: "drive", failure: r } : { provider: "drive", targets: r };
    }
    if (host === "we.tl" || host === "wetransfer.com") {
      const r = await wetransferTarget(link, doFetch);
      return typeof r === "string" ? { provider: "wetransfer", failure: r } : { provider: "wetransfer", targets: r };
    }
  } catch {
    return { provider: host === "drive.google.com" ? "drive" : "wetransfer", failure: "error" };
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
/** Tiempo máximo para que el servidor empiece a responder. La descarga en sí no tiene límite de tiempo ni de tamaño. */
const CONNECT_TIMEOUT_MS = 60_000;

/**
 * Abre la descarga siguiendo las redirecciones a mano: cada salto tiene que ser a un host permitido.
 * Devuelve el archivo abierto para escribirlo a disco de a pedazos (no tiene tope de tamaño).
 */
export async function openLink(target: LinkTarget, opts: { fetchImpl?: Fetch } = {}): Promise<OpenResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  let url = target.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedHost(target.provider, url)) {
        const host = hostOf(url);
        return { ok: false, reason: host && LOGIN_HOSTS.some((re) => re.test(host)) ? "private" : "error" };
      }
      // El corte por tiempo vale solo hasta que llegan las cabeceras: un archivo grande puede tardar lo que tarde.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), CONNECT_TIMEOUT_MS);
      let res: Response;
      try {
        res = await doFetch(url, { redirect: "manual", signal: abort.signal, headers: UA });
      } finally {
        clearTimeout(timer);
      }
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!next) return { ok: false, reason: "error" };
        url = new URL(next, url).toString();
        continue;
      }
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "private" };
      if (res.status === 404 || res.status === 410) return { ok: false, reason: "not_found" };
      if (res.status !== 200 || !res.body) return { ok: false, reason: "error" };

      const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim().toLowerCase();
      // Una página web en vez del archivo: Drive muestra "necesitás permiso" o un aviso.
      if (mime === "text/html") {
        await res.body.cancel().catch(() => undefined);
        return { ok: false, reason: target.provider === "drive" ? "private" : "not_a_file" };
      }
      const declared = Number(res.headers.get("content-length") ?? 0);
      return {
        ok: true,
        file: { filename: filenameFrom(res.headers.get("content-disposition"), "archivo"), mime, declaredBytes: declared > 0 ? declared : null, body: res.body },
      };
    }
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
