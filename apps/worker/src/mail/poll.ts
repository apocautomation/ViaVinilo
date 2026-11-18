import type { PrismaClient } from "@prisma/client";
import type { WorkerConfig } from "../config";
import { ingestMail, type IngestDeps } from "./ingest";
import { openImapMailbox, pollImapSector } from "./sources/imap";
import { pollMailHog } from "./sources/mailhog";

/** Una vuelta de lectura de todas las casillas. La corre el job programado cada minuto. */
export async function pollAllMailboxes(config: WorkerConfig, deps: IngestDeps & { prisma: PrismaClient }) {
  const sectors = await deps.prisma.sector.findMany({ where: { active: true } });

  if (config.mailSource === "mailhog") {
    const r = await pollMailHog(config.mailhogUrl, sectors, (sector, raw) => ingestMail(deps, sector, raw));
    if (r.processed || r.ignored) console.log(`[mail] MailHog: ${r.processed} procesados, ${r.ignored} sin casilla de sector`);
    return;
  }

  if (config.mailSource === "imap") {
    for (const sector of sectors) {
      const creds = config.imap[sector.code];
      if (!creds) continue;
      try {
        const r = await pollImapSector(
          deps.prisma,
          sector,
          () => openImapMailbox(creds),
          (raw) => ingestMail(deps, sector, raw),
        );
        if (r.processed) console.log(`[mail] ${sector.name}: ${r.processed} mails nuevos`);
      } catch (err) {
        // Una casilla con problemas no frena a las demás; queda registrado para monitorear.
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[mail] ${sector.name}: error al leer la casilla`, message);
        await deps.prisma.mailboxState.upsert({
          where: { sectorId: sector.id },
          update: { lastError: message.slice(0, 2000), lastPolledAt: new Date() },
          create: { sectorId: sector.id, lastError: message.slice(0, 2000), lastPolledAt: new Date() },
        });
      }
    }
  }
}
