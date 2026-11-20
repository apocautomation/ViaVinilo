import { PrismaClient } from "@prisma/client";
import { fillPendingContact } from "./mail/ingest";

/**
 * D-054, una sola vez: completa las altas pendientes que se crearon antes de leer la ficha del
 * mail (quedaron como "Cliente N.º …" sin nombre). Usa los mails ya guardados en Conversaciones.
 * Uso en el servidor: docker compose exec worker node dist/backfill-pending.js
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const pending = await prisma.customer.findMany({
      where: { status: "PENDING", firstName: null, deletedAt: null },
      select: { id: true, customerNumber: true, conversation: { select: { messages: { where: { direction: "IN" }, orderBy: { createdAt: "asc" }, select: { body: true } } } } },
    });
    let filled = 0;
    for (const c of pending) {
      for (const m of c.conversation?.messages ?? []) {
        const after = await fillPendingContact(prisma, c.id, { text: m.body, fromName: null });
        if (after.firstName) {
          filled++;
          console.log(`N.º ${c.customerNumber}: ${after.firstName} ${after.lastName ?? ""}`.trim());
          break;
        }
      }
    }
    console.log(`Altas pendientes sin nombre: ${pending.length}. Completadas: ${filled}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
