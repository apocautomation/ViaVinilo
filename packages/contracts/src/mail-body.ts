/**
 * Ordena el texto de un mail para mostrarlo en Conversaciones (D-057), sin cambiar lo que dice:
 * - los links ("<https://drive…>") se separan como enlaces, con el nombre de archivo que los precede;
 * - lo citado de un mail anterior ("El vie, 20 nov… escribió:", "> …", "De: … Enviado: …") va aparte;
 * - se sacan los espacios y renglones vacíos de más.
 */

export interface MailLink {
  url: string;
  /** Nombre que el cliente puso antes del link (ej. "Carpinteria_A.jpg") o el sitio. */
  label: string;
}

export interface MailBodyParts {
  text: string;
  links: MailLink[];
  /** Lo citado del mail anterior, si hay. */
  quoted: string | null;
  /** Quién escribió lo citado, si se puede leer ("dtfuv@viavinilo.com"). */
  quotedFrom: string | null;
}

const URL_RE = /<?(https?:\/\/[^\s<>]+)>?/g;
const QUOTE_HEADERS = [
  /^(?:El|On)\s.+(?:escribió|wrote):\s*$/i,
  /^-{2,}\s*(?:Mensaje original|Original Message|Forwarded message|Mensaje reenviado)\s*-{2,}\s*$/i,
  /^_{8,}\s*$/,
];
const FILE_RE = /\.(?:jpe?g|png|pdf|tiff?|ai|eps|psd|cdr|svg|zip|rar)\s*$/i;

function siteName(url: string): string {
  const host = (/^https?:\/\/([^/?#:]+)/i.exec(url)?.[1] ?? "").toLowerCase().replace(/^www\./, "");
  if (host.includes("drive.google") || host.includes("docs.google")) return "Google Drive";
  if (host.includes("wetransfer") || host === "we.tl") return "WeTransfer";
  if (host.includes("dropbox")) return "Dropbox";
  return host || "Enlace";
}

function tidy(lines: string[]): string {
  return lines
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMailBody(body: string): MailBodyParts {
  const all = body.replace(/\r\n?/g, "\n").split("\n");

  // Dónde empieza lo citado: un encabezado de respuesta/reenvío, o un bloque de líneas con ">".
  let cut = all.findIndex((l) => QUOTE_HEADERS.some((re) => re.test(l.trim())));
  const firstQuote = all.findIndex((l) => /^\s*>/.test(l));
  if (firstQuote >= 0 && (cut < 0 || firstQuote < cut)) {
    // Solo si de ahí en adelante casi todo es cita (no una línea suelta con ">").
    const rest = all.slice(firstQuote).filter((l) => l.trim());
    if (rest.length && rest.filter((l) => /^\s*>/.test(l)).length / rest.length > 0.6) cut = firstQuote;
  }
  // Un mail que es todo reenvío (empieza con el encabezado) no se esconde: el contenido es eso.
  if (cut >= 0 && !all.slice(0, cut).some((l) => l.trim())) cut = -1;

  const main = cut >= 0 ? all.slice(0, cut) : all;
  const quotedLines = cut >= 0 ? all.slice(cut) : [];

  const links: MailLink[] = [];
  const kept: string[] = [];
  let pendingLabel: string | null = null;
  for (const raw of main) {
    const line = raw.trim();
    const urls = [...line.matchAll(URL_RE)].map((m) => m[1]!.replace(/[).,;]+$/, ""));
    if (!urls.length) {
      // Un nombre de archivo suelto suele ser la etiqueta del link de la línea siguiente.
      if (FILE_RE.test(line) && line.length <= 120) {
        if (pendingLabel) kept.push(pendingLabel);
        pendingLabel = line;
      } else {
        if (pendingLabel) kept.push(pendingLabel);
        pendingLabel = null;
        kept.push(raw);
      }
      continue;
    }
    const textPart = line.replace(URL_RE, "").trim();
    urls.forEach((url, i) => {
      const label = (i === 0 && (pendingLabel ?? (FILE_RE.test(textPart) ? textPart : null))) || siteName(url);
      if (!links.some((l) => l.url === url)) links.push({ url, label });
    });
    if (textPart && !(FILE_RE.test(textPart) && urls.length)) kept.push(textPart);
    pendingLabel = null;
  }
  if (pendingLabel) kept.push(pendingLabel);

  const quoted = quotedLines.length ? tidy(quotedLines.map((l) => l.replace(/^\s*>\s?/, ""))) : null;
  const quotedFrom = quotedLines.length ? (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(quotedLines.slice(0, 4).join(" "))?.[0] ?? null) : null;

  return { text: tidy(kept), links, quoted: quoted || null, quotedFrom };
}
