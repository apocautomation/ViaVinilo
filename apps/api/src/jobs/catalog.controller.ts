import { Controller, Get } from "@nestjs/common";
import { JOB_STATUS_LABELS } from "@viavinilo/contracts";
import { CurrentUser, type AuthUser } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { SectorAccess } from "./sector-access";

/** Datos de referencia para el tablero: sectores visibles para el usuario y motivos de error. */
@Controller()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SectorAccess,
  ) {}

  @Get("sectors")
  async sectors(@CurrentUser() user: AuthUser) {
    const allowed = await this.access.allowedSectorIds(user);
    const sectors = await this.prisma.sector.findMany({
      where: { active: true, ...(allowed === "all" ? {} : { id: { in: allowed } }) },
      include: { stages: { orderBy: { position: "asc" } } },
      orderBy: { name: "asc" },
    });
    return sectors.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      stages: s.stages.map((st) => ({ status: st.status, label: JOB_STATUS_LABELS[st.status] })),
    }));
  }

  @Get("file-error-reasons")
  reasons() {
    return this.prisma.fileErrorReason.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, label: true },
    });
  }
}
