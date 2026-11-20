import type { PrismaClient, Sector } from "@prisma/client";
import { normalizeEmail } from "@viavinilo/contracts";
import type { WorkerConfig } from "../config";
import { ingestMail, type IngestDeps } from "./ingest";
import { hostingerMailboxIds, openHostingerMailbox } from "./sources/hostinger-api";
import { openImapMailbox, pollImapSector, type ImapMailbox } from "./sources/imap";
import { pollMailHog } from "./sources/mailhog";

/** Una vuelta de lectura de todas las casillas. La corre el job programado cada minuto. */
export async function pollAllMailboxes(config: WorkerConfig, deps: IngestDeps & { prisma: PrismaClient }) {
  const sectors = await deps.prisma.sector.findMany({ where: { active: true } });

  if (config.mailSource === "mailhog") {
    const r = await pollMailHog(config.mailhogUrl, sectors, (sector, raw) => ingestMail(deps, sector, raw));
    if (r.processed || r.ignored) console.log(`[mail] MailHog: ${r.processed} procesados, ${r.ignored} sin casilla de sector`);
    return;
  }

  if (config.mailSource === "hostinger-api" && config.hostinger) {
    const hostinger = config.hostinger;
    // Las casillas que ve el token, por dirección; cada sector lee la suya (D-043).
    const ids = await hostingerMailboxIds(hostinger);
    for (const sector of sectors) {
      const mailboxId = sector.inboxEmail ? ids.get(normalizeEmail(sector.inboxEmail)) : undefined;
      if (!mailboxId) continue;
      await pollSector(deps, sector, () => openHostingerMailbox(hostinger, mailboxId));
    }
    return;
  }

  if (config.mailSource === "imap") {
    for (const sector of sectors) {
      const creds = config.imap[sector.code];
      if (!creds) continue;
      await pollSector(deps, sector, () => openImapMailbox(creds));
    }
  }
}

/** Lee una casilla. Una casilla con problemas no frena a las demás; el error queda para monitorear. */
async function pollSector(deps: IngestDeps & { prisma: PrismaClient }, sector: Sector, open: () => Promise<ImapMailbox>) {
  try {
    const r = await pollImapSector(deps.prisma, sector, open, (raw) => ingestMail(deps, sector, raw));
    if (r.processed) console.log(`[mail] ${sector.name}: ${r.processed} mails nuevos`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mail] ${sector.name}: error al leer la casilla`, message);
    await deps.prisma.mailboxState.upsert({
      where: { sectorId: sector.id },
      update: { lastError: message.slice(0, 2000), lastPolledAt: new Date() },
      create: { sectorId: sector.id, lastError: message.slice(0, 2000), lastPolledAt: new Date() },
    });
  }
}
