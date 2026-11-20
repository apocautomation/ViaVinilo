import type { PrismaClient, Sector } from "@prisma/client";
import { ImapFlow } from "imapflow";

/** Lo mínimo que la lectura necesita de una casilla IMAP. Permite probarla sin un servidor real. */
export interface ImapMailbox {
  uidValidity: bigint;
  /** UID que va a tener el próximo mail que llegue. */
  uidNext: number;
  /** Mails con UID mayor a `afterUid`, en orden. */
  fetchAfter(afterUid: number): AsyncIterable<{ uid: number; source: Buffer }>;
  close(): Promise<void>;
}

export interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/** Abre la bandeja de entrada de una casilla de Hostinger con ImapFlow. Solo lee: no marca nada. */
export async function openImapMailbox(creds: ImapCredentials): Promise<ImapMailbox> {
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX", { readOnly: true });
  const box = client.mailbox;
  if (!box) throw new Error("No se pudo abrir INBOX");
  return {
    uidValidity: BigInt(box.uidValidity),
    uidNext: box.uidNext,
    async *fetchAfter(afterUid: number) {
      // "n:*" siempre devuelve al menos el último mail aunque su UID sea menor: se filtra.
      for await (const msg of client.fetch(`${afterUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (msg.uid > afterUid && msg.source) yield { uid: msg.uid, source: msg.source };
      }
    },
    async close() {
      lock.release();
      await client.logout();
    },
  };
}

/**
 * Lee los mails nuevos de la casilla de un sector y los pasa a `ingest` de a uno.
 *
 * - La primera vez arranca desde "ahora": no importa el historial de la casilla (si no, entrarían
 *   años de mails como órdenes nuevas).
 * - Avanza el último UID procesado después de cada mail, así un corte no repite ni saltea mails.
 * - Si cambia el UIDVALIDITY (el servidor renumeró la casilla) vuelve a arrancar desde ahora y lo
 *   deja registrado en lastError. La deduplicación por Message-ID evita órdenes repetidas.
 */
export async function pollImapSector(
  prisma: PrismaClient,
  sector: Sector,
  open: () => Promise<ImapMailbox>,
  ingest: (raw: Buffer, uid: number) => Promise<unknown>,
): Promise<{ processed: number }> {
  const box = await open();
  let processed = 0;
  try {
    const state = await prisma.mailboxState.findUnique({ where: { sectorId: sector.id } });
    let lastUid: number;
    let note: string | null = null;

    if (!state || state.uidValidity === null) {
      lastUid = box.uidNext - 1;
    } else if (state.uidValidity !== box.uidValidity) {
      lastUid = box.uidNext - 1;
      note = `Cambió el UIDVALIDITY de la casilla (${state.uidValidity} → ${box.uidValidity}); se retoma desde ahora`;
    } else {
      lastUid = state.lastUid;
    }

    await prisma.mailboxState.upsert({
      where: { sectorId: sector.id },
      update: { uidValidity: box.uidValidity, lastUid, lastPolledAt: new Date(), lastError: note },
      create: { sectorId: sector.id, uidValidity: box.uidValidity, lastUid, lastPolledAt: new Date(), lastError: note },
    });

    for await (const msg of box.fetchAfter(lastUid)) {
      await ingest(msg.source, msg.uid);
      processed++;
      await prisma.mailboxState.update({ where: { sectorId: sector.id }, data: { lastUid: msg.uid } });
    }
  } finally {
    await box.close();
  }
  return { processed };
}
