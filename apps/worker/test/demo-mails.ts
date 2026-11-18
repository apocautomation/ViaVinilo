// Carga órdenes de demo pasando por la ingesta real de mails (para probar el tablero a mano).
// Uso: DATABASE_URL=... STORAGE_DIR=... pnpm exec tsx test/demo-mails.ts
import { PrismaClient } from "@prisma/client";
import { ingestMail } from "../src/mail/ingest";
import { LocalDiskStorage } from "../src/storage";
import { buildMail, fakePdf } from "./mail-fixtures";

async function main() {
  const prisma = new PrismaClient();
  const deps = {
    prisma,
    storage: new LocalDiskStorage(process.env.STORAGE_DIR ?? "./storage"),
    notifier: { sendSignupInvite: async ({ to }: { to: string }) => console.log(`(link de alta para ${to})`) },
  };
  const clientes = [
    { first: "Juan", last: "Pérez", dni: "30123456", email: "juan@remeras.test" },
    { first: "María", last: "López", dni: "27555444", email: "maria@estampados.test" },
  ];
  for (const c of clientes) {
    await prisma.customer.upsert({
      where: { dni: c.dni },
      update: {},
      create: {
        status: "ACTIVE", firstName: c.first, lastName: c.last, dni: c.dni,
        searchText: `${c.first} ${c.last}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(),
        emails: { create: { email: c.email, isPrimary: true } },
      },
    });
  }
  const dtf = await prisma.sector.findUniqueOrThrow({ where: { code: "DTF" } });
  const subli = await prisma.sector.findUniqueOrThrow({ where: { code: "SUBLIMACION" } });
  await prisma.user.upsert({
    where: { email: "impresor@viavinilo.test" },
    update: {},
    create: { email: "impresor@viavinilo.test", name: "Impresor DTF", roles: ["PRODUCTION"], sectors: { create: { sectorId: dtf.id } } },
  });

  const mails = [
    { from: "juan@remeras.test", sector: dtf, subject: "Remeras escuela 30x40cm", files: ["frente.pdf", "espalda.pdf"] },
    { from: "maria@estampados.test", sector: dtf, subject: "Logo 25 x 25 cm x 50 unidades", files: ["logo.png"] },
    { from: "juan@remeras.test", sector: dtf, subject: "Urgente para mañana 1,20 x 0,50 m", files: ["banner.pdf"] },
    { from: "nuevo@gremio.test", sector: dtf, subject: "Hola, quiero imprimir esto", files: ["diseno.pdf"] },
    { from: "maria@estampados.test", sector: subli, subject: "Tela sublimada 3 metros", files: ["tela.tif"] },
  ];
  let i = 0;
  for (const m of mails) {
    const raw = await buildMail({
      from: m.from, to: m.sector.inboxEmail!, subject: m.subject, messageId: `<demo-${++i}@test>`,
      text: `Hola! Te mando el pedido: ${m.subject}. Gracias`,
      attachments: m.files.map((f) => fakePdf(f, 2048)),
    });
    const out = await ingestMail(deps, m.sector, raw);
    console.log(`${m.subject} → ${out.result}`);
  }
  await prisma.$disconnect();
}
main();
