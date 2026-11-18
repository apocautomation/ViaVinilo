import { PrismaClient } from "@prisma/client";
import { FILE_ERROR_REASONS, MACHINES, buildSectors } from "./seed-data";

/** Seed idempotente: se puede correr varias veces sin duplicar. */
async function main() {
  const prisma = new PrismaClient();
  const mailDomain = process.env.SEED_MAIL_DOMAIN ?? "viavinilo.local";

  try {
    const sectorIds = new Map<string, string>();

    for (const s of buildSectors(mailDomain)) {
      const sector = await prisma.sector.upsert({
        where: { code: s.code },
        update: { name: s.name, inboxEmail: s.inboxEmail },
        create: { code: s.code, name: s.name, inboxEmail: s.inboxEmail },
      });
      sectorIds.set(s.code, sector.id);

      // La secuencia se reemplaza completa para respetar las posiciones únicas.
      await prisma.$transaction([
        prisma.sectorStage.deleteMany({ where: { sectorId: sector.id } }),
        prisma.sectorStage.createMany({
          data: s.stages.map((st) => ({ sectorId: sector.id, status: st.status, position: st.position })),
        }),
      ]);
    }

    for (const m of MACHINES) {
      const machine = await prisma.machine.upsert({
        where: { name: m.name },
        update: {},
        create: { name: m.name },
      });
      await prisma.machineSector.createMany({
        data: m.sectors.map((code) => ({ machineId: machine.id, sectorId: sectorIds.get(code)! })),
        skipDuplicates: true,
      });
    }

    for (const r of FILE_ERROR_REASONS) {
      await prisma.fileErrorReason.upsert({
        where: { code: r.code },
        update: { label: r.label, sortOrder: r.sortOrder },
        create: r,
      });
    }

    console.log(
      `Seed OK: ${sectorIds.size} sectores, ${MACHINES.length} máquinas, ${FILE_ERROR_REASONS.length} motivos de error.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
