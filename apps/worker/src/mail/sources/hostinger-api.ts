import { normalizeEmail } from "@viavinilo/contracts";
import type { ImapMailbox } from "./imap";

/**
 * Fuente de producción con la API de mail de Hostinger (D-043): lee las casillas de sector con un
 * token, sin las contraseñas. Se presenta como una `ImapMailbox`, así reusa toda la lógica de
 * `pollImapSector`: arranca desde "ahora", avanza el último UID y no repite ni saltea mails.
 *
 * Solo lee: usa `/source` (el MIME completo), que según la documentación no marca el mail como
 * leído. Probado contra la API real el 20/11: después de bajar el source el mail sigue sin leer.
 */
export interface HostingerMailConfig {
  token: string;
  baseUrl: string;
}

export const HOSTINGER_MAIL_API = "https://api.mail.hostinger.com/api/v1";

interface ApiMessage {
  uid: number;
}
interface ApiPage<T> {
  data: T[];
  pagination: { page: number; totalPages: number };
}

const PER_PAGE = 100;

export class HostingerMailError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

function client(config: HostingerMailConfig, fetchFn: typeof fetch) {
  return async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetchFn(`${config.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      const why = res.status === 429 ? "demasiados pedidos a la API de mail (429), se reintenta en la próxima vuelta" : body.error;
      throw new HostingerMailError(`API de mail de Hostinger: ${why ?? `HTTP ${res.status}`}`, res.status, body.code);
    }
    return res;
  };
}

/** Casillas que ve el token: dirección (en minúsculas) → id de la casilla en la API. */
export async function hostingerMailboxIds(
  config: HostingerMailConfig,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const res = await client(config, fetchFn)("/me");
  const { data } = (await res.json()) as { data: { mailboxes: { resourceId: string; address: string }[] } };
  return new Map(data.mailboxes.map((m) => [normalizeEmail(m.address), m.resourceId]));
}

export async function openHostingerMailbox(
  config: HostingerMailConfig,
  mailboxId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ImapMailbox> {
  const call = client(config, fetchFn);
  const inbox = `/mailboxes/${encodeURIComponent(mailboxId)}/folders/INBOX/messages`;

  const latest = (await (await call(`${inbox}?perPage=1&sort=-uid`)).json()) as ApiPage<ApiMessage>;
  const uidNext = (latest.data[0]?.uid ?? 0) + 1;

  return {
    // La API no expone el UIDVALIDITY: se usa un valor fijo. Si Hostinger renumerara la casilla,
    // la deduplicación por Message-ID evita órdenes repetidas (D-027).
    uidValidity: 1n,
    uidNext,
    async *fetchAfter(afterUid: number) {
      for (let page = 1; ; page++) {
        const res = await call(`${inbox}/search?sort=uid&perPage=${PER_PAGE}&page=${page}`, {
          method: "POST",
          body: JSON.stringify({ uid: `${afterUid + 1}:*` }),
        });
        const { data, pagination } = (await res.json()) as ApiPage<ApiMessage>;
        for (const msg of data) {
          // "n:*" siempre devuelve al menos el último mail aunque su UID sea menor: se filtra.
          if (msg.uid <= afterUid) continue;
          const source = await call(`${inbox}/${msg.uid}/source`);
          yield { uid: msg.uid, source: Buffer.from(await source.arrayBuffer()) };
        }
        if (page >= pagination.totalPages) return;
      }
    },
    async close() {},
  };
}
