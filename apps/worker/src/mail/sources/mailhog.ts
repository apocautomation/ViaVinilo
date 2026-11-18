import type { Sector } from "@prisma/client";
import { normalizeEmail } from "@viavinilo/contracts";

/**
 * Fuente de desarrollo: MailHog (docker compose) recibe los mails por SMTP y los expone por su API.
 * MailHog no tiene IMAP; en producción la fuente es IMAP contra Hostinger (imap.ts).
 *
 * Cada mail se ingiere en el sector de cada destinatario que sea una casilla de sector, y después
 * se borra de MailHog para no releerlo.
 */
interface MailHogMessage {
  ID: string;
  Raw: { From: string; To: string[]; Data: string };
}

export async function pollMailHog(
  baseUrl: string,
  sectors: Sector[],
  ingest: (sector: Sector, raw: Buffer) => Promise<unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<{ processed: number; ignored: number }> {
  const byInbox = new Map(sectors.filter((s) => s.inboxEmail).map((s) => [normalizeEmail(s.inboxEmail!), s]));
  const res = await fetchFn(`${baseUrl}/api/v2/messages?start=0&limit=50`);
  if (!res.ok) throw new Error(`MailHog respondió ${res.status}`);
  const { items } = (await res.json()) as { items: MailHogMessage[] };

  let processed = 0;
  let ignored = 0;
  // MailHog lista del más nuevo al más viejo: se procesan en orden de llegada.
  for (const item of [...items].reverse()) {
    const targets = [...new Set(item.Raw.To.map(normalizeEmail))]
      .map((to) => byInbox.get(to))
      .filter((s): s is Sector => Boolean(s));
    if (targets.length === 0) ignored++;
    for (const sector of targets) {
      await ingest(sector, Buffer.from(item.Raw.Data, "utf8"));
      processed++;
    }
    await fetchFn(`${baseUrl}/api/v1/messages/${encodeURIComponent(item.ID)}`, { method: "DELETE" });
  }
  return { processed, ignored };
}
