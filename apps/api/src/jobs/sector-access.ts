import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Producción solo ve y mueve las órdenes de su(s) sector(es) (D-017). Dueño y atención ven todos.
 */
@Injectable()
export class SectorAccess {
  constructor(private readonly prisma: PrismaService) {}

  async allowedSectorIds(user: AuthUser): Promise<string[] | "all"> {
    if (user.roles.includes("OWNER") || user.roles.includes("ATTENTION")) return "all";
    const rows = await this.prisma.userSector.findMany({ where: { userId: user.id }, select: { sectorId: true } });
    const own = rows.map((r) => r.sectorId);
    if (!own.length) return own;
    // D-082: quien tiene un tablero ve también sus sub-servicios (Gran Formato → Látex, Ecosolvente…).
    const children = await this.prisma.sector.findMany({ where: { parentId: { in: own } }, select: { id: true } });
    return [...new Set([...own, ...children.map((c) => c.id)])];
  }

  async assert(user: AuthUser, sectorId: string) {
    const allowed = await this.allowedSectorIds(user);
    if (allowed !== "all" && !allowed.includes(sectorId)) {
      throw new ForbiddenException("No tenés acceso a este sector");
    }
  }
}
