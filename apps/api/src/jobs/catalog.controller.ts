import { ConflictException, Controller, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createSectorSchema, JOB_STATUS_LABELS, sectorCodeFromName, sequenceForNewSector, updateSectorSchema } from "@viavinilo/contracts";
import { AuditService } from "../audit/audit.service";
import { CurrentUser, CustomerAuth, Roles, type AuthUser } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { PrismaService } from "../prisma/prisma.service";
import { SectorAccess } from "./sector-access";

/** Datos de referencia para el tablero: sectores visibles para el usuario y motivos de error. */
@Controller()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SectorAccess,
    private readonly audit: AuditService,
  ) {}

  /** Todos los tableros, también los desactivados, para administrarlos (D-064). */
  @Get("sectors/all")
  @Roles("OWNER")
  async allSectors() {
    const sectors = await this.prisma.sector.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { jobs: true } }, stages: { orderBy: { position: "asc" } } } });
    return sectors.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      inboxEmail: s.inboxEmail,
      active: s.active,
      jobs: s._count.jobs,
      stages: s.stages.map((st) => JOB_STATUS_LABELS[st.status]),
    }));
  }

  /**
   * Crea un tablero (D-064). Nace con los pasos comunes (o con "En proceso de calandra"). Si tiene
   * casilla, los mails que lleguen ahí crean pedidos en este tablero. Lo usan el bot y la app.
   */
  @Post("sectors")
  @Roles("OWNER")
  async createSector(@ZodBody(createSectorSchema) body: { name: string; inboxEmail?: string; withCalender: boolean }, @CurrentUser() user: AuthUser) {
    const code = sectorCodeFromName(body.name);
    if (code.length < 2) throw new ConflictException("Poné un nombre con letras o números");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const sector = await tx.sector.create({
          data: {
            code,
            name: body.name,
            inboxEmail: body.inboxEmail ?? null,
            stages: { create: sequenceForNewSector(body.withCalender).map((status, i) => ({ status, position: i + 1 })) },
          },
        });
        await this.audit.log({ entity: "Sector", entityId: sector.id, action: "create", userId: user.id, after: { code, name: body.name, inboxEmail: body.inboxEmail ?? null } }, tx);
        return { id: sector.id, code: sector.code, name: sector.name };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Ya existe un tablero con ese nombre o con esa casilla");
      }
      throw err;
    }
  }

  /** Renombra, cambia la casilla o desactiva un tablero. Desactivado no se borra: sus pedidos quedan. */
  @Patch("sectors/:id")
  @Roles("OWNER")
  async updateSector(
    @Param("id") id: string,
    @ZodBody(updateSectorSchema) body: { name?: string; inboxEmail?: string | null; active?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const before = await this.prisma.sector.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("No encontramos ese tablero");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const after = await tx.sector.update({ where: { id }, data: body });
        await this.audit.log(
          {
            entity: "Sector",
            entityId: id,
            action: "update",
            userId: user.id,
            before: { name: before.name, inboxEmail: before.inboxEmail, active: before.active },
            after: { name: after.name, inboxEmail: after.inboxEmail, active: after.active },
          },
          tx,
        );
        return { id: after.id, code: after.code, name: after.name, inboxEmail: after.inboxEmail, active: after.active };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Esa casilla ya la usa otro tablero");
      throw err;
    }
  }

  /** Tableros activos para la app de clientes: a cuál mandar un archivo (D-064). */
  @Get("app/sectors")
  @CustomerAuth()
  appSectors() {
    return this.prisma.sector.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { code: true, name: true, inboxEmail: true } });
  }

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
