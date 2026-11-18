/**
 * Links de servicios para mandar archivos pesados. En la E1 se guardan en la orden y no se
 * descargan solos (SPEC E1.1).
 */
const TRANSFER_HOSTS = [
  "wetransfer.com",
  "we.tl",
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
  "db.tt",
  "mega.nz",
  "1drv.ms",
  "onedrive.live.com",
  "transfernow.net",
  "smash.gg",
  "fromsmash.com",
];

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractTransferLinks(...texts: (string | undefined)[]): string[] {
  const links = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(URL_RE)) {
      const url = match[0].replace(/[.,;:]+$/, "");
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (TRANSFER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) links.add(url);
      } catch {
        // URL mal formada: se ignora
      }
    }
  }
  return [...links];
}
