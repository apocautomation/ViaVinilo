import { PrismaClient } from "@prisma/client";
import { customerSearchText } from "@viavinilo/contracts";
import { splitName } from "./mail/contact";
import { forwardedSender } from "./mail/ingest";

/**
 * D-057, una sola vez: antes de este cambio, un reenvío desde una casilla nuestra creaba un alta
 * pendiente con el email de Via Vinilo (ej. dtfuv@). Esto pasa sus pedidos y su hilo al cliente del
 * mail original y da de baja esa alta falsa (baja lógica, con auditoría).
 * Uso: docker compose exec worker node dist/fix-forwards.js
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const sectors = await prisma.sector.findMany({ select: { inboxEmail: true } });
    const own = new Set(sectors.map((s) => s.inboxEmail?.split("@")[1]?.toLowerCase()).filter((d): d is string => Boolean(d)));
    const bogus = await prisma.customer.findMany({
      where: { status: "PENDING", deletedAt: null, emails: { some: { OR: [...own].map((d) => ({ email: { endsWith: `@${d}` } })) } } },
      include: { emails: true, conversation: { include: { messages: { where: { direction: "IN", channel: "MAIL" }, orderBy: { createdAt: "asc" } } } } },
    });
    for (const b of bogus) {
      const msgs = b.conversation?.messages ?? [];
      const original = msgs.map((m) => forwardedSender(m.body, own)).find(Boolean);
      if (!original) {
        console.log(`N.º ${b.customerNumber}: no encontré el remitente original; queda para revisar a mano`);
        continue;
      }
      await prisma.$transaction(async (tx) => {
        const existing = await tx.customerEmail.findUnique({ where: { email: original.email }, include: { customer: true } });
        const name = splitName(original.name ?? "");
        const target =
          existing && !existing.customer.deletedAt
            ? existing.customer
            : await tx.customer.create({
                data: {
                  status: "PENDING",
                  firstName: name.firstName,
                  lastName: name.lastName,
                  searchText: customerSearchText(name),
                  internalNotes: `Pedido reenviado por ${b.emails[0]?.email} (D-057)`,
                  emails: { create: { email: original.email, isPrimary: true } },
                },
              });
        await tx.jobOrder.updateMany({ where: { customerId: b.id }, data: { customerId: target.id } });
        if (b.conversation) {
          const targetConv = await tx.conversation.findUnique({ where: { customerId: target.id } });
          if (targetConv) {
            await tx.message.updateMany({ where: { conversationId: b.conversation.id }, data: { conversationId: targetConv.id } });
            await tx.conversation.delete({ where: { id: b.conversation.id } });
          } else {
            await tx.conversation.update({ where: { id: b.conversation.id }, data: { customerId: target.id } });
          }
        }
        // El email de la casilla queda libre y el alta falsa, dada de baja.
        await tx.customerEmail.deleteMany({ where: { customerId: b.id } });
        await tx.customer.update({ where: { id: b.id }, data: { deletedAt: new Date() } });
        await tx.auditLog.create({
          data: {
            entity: "Customer",
            entityId: b.id,
            action: "delete",
            before: { customerNumber: b.customerNumber, email: b.emails[0]?.email ?? null },
            after: { reason: "Alta creada por un reenvío desde una casilla de Via Vinilo (D-057)", movedTo: target.customerNumber },
          },
        });
        console.log(`N.º ${b.customerNumber} (${b.emails[0]?.email}) → N.º ${target.customerNumber} (${original.email})`);
      });
    }
    console.log(`Altas con email de Via Vinilo: ${bogus.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
