import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import { FILE_ERROR_REASONS, MACHINES, SECTOR_VARIANTS, buildSectors } from "./seed-data";

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

    // D-082: los sub-servicios cuelgan de su tablero (Látex, Ecosolvente… dentro de Gran Formato).
    for (const s of buildSectors(mailDomain)) {
      await prisma.sector.update({ where: { code: s.code }, data: { parentId: s.parent ? sectorIds.get(s.parent)! : null } });
    }

    // D-095, D-108: opciones de impresión (catálogo de los Excel de Ricardo). Si el código ya existe en ese
    // tablero, no se toca (lo edita el dueño).
    for (const v of SECTOR_VARIANTS) {
      const sectorId = sectorIds.get(v.sector)!;
      await prisma.sectorVariant.upsert({
        where: { sectorId_code: { sectorId, code: v.code } },
        update: {},
        create: {
          sectorId,
          code: v.code,
          name: v.name,
          tangoSku: v.tangoSku,
          width: v.width,
          usableWidth: v.usableWidth,
          sortOrder: v.sortOrder,
        },
      });
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

    // Usuario dueño inicial, solo si se definió en el entorno. Nunca se pisa la contraseña de uno existente.
    const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD;
    let ownerMsg = "sin usuario dueño (definí SEED_OWNER_EMAIL y SEED_OWNER_PASSWORD)";
    if (ownerEmail && ownerPassword) {
      const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: ownerEmail,
            name: process.env.SEED_OWNER_NAME ?? "Dueño",
            roles: ["OWNER"],
            passwordHash: await hashPassword(ownerPassword),
          },
        });
        ownerMsg = `usuario dueño ${ownerEmail} creado`;
      } else {
        ownerMsg = `usuario dueño ${ownerEmail} ya existía (no se tocó)`;
      }
    }

    console.log(
      `Seed OK: ${sectorIds.size} sectores, ${MACHINES.length} máquinas, ${FILE_ERROR_REASONS.length} motivos de error; ${ownerMsg}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
