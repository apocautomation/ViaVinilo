import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

/** Log de auditoría de acciones sensibles (CLAUDE.md). Se escribe dentro de la misma transacción. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    entry: {
      entity: string;
      entityId: string;
      action: string;
      userId: string;
      before?: unknown;
      after?: unknown;
    },
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: {
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        userId: entry.userId,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
