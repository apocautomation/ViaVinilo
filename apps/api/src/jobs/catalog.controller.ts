import { BadRequestException, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Put } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { botToggleSchema, createSectorSchema, createVariantSchema, updateVariantSchema, JOB_STATUS_LABELS, sectorCodeFromName, sequenceForNewSector, updateSectorSchema } from "@viavinilo/contracts";
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

  /**
   * Control automático del archivo (D-065): si está prendido, un archivo claramente mal pasa solo a
   * "Archivo con error". Apagado, el control igual corre y deja la sugerencia en la tarjeta.
   */
  @Get("settings/file-check")
  async fileCheckSetting() {
    const row = await this.prisma.appSetting.findUnique({ where: { key: "auto-file-error" } });
    const v = row?.value as { enabled?: unknown; since?: unknown } | null;
    return { enabled: v?.enabled === true, since: typeof v?.since === "string" ? v.since : null };
  }

  /** Lo prende o apaga solo el dueño. Al prenderlo vale para los archivos que lleguen desde ese momento. */
  @Put("settings/file-check")
  @Roles("OWNER")
  async setFileCheck(@ZodBody(botToggleSchema) body: { enabled: boolean }, @CurrentUser() user: AuthUser) {
    const before = await this.fileCheckSetting();
    const value = { enabled: body.enabled, since: body.enabled ? new Date().toISOString() : before.since };
    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: "auto-file-error" },
        create: { key: "auto-file-error", value, updatedById: user.id },
        update: { value, updatedById: user.id },
      });
      await this.audit.log({ entity: "AppSetting", entityId: "auto-file-error", action: "update", userId: user.id, before: { enabled: before.enabled }, after: { enabled: body.enabled } }, tx);
    });
    return this.fileCheckSetting();
  }

  /** Todos los tableros, también los desactivados, para administrarlos (D-064). */
  @Get("sectors/all")
  @Roles("OWNER")
  async allSectors() {
    const sectors = await this.prisma.sector.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { jobs: true } },
        stages: { orderBy: { position: "asc" } },
        variants: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, active: true, sortOrder: true } },
      },
    });
    const names = new Map(sectors.map((s) => [s.id, s.name]));
    return sectors.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      /** Tablero del que es sub-servicio (D-082), o null. */
      parent: s.parentId ? (names.get(s.parentId) ?? null) : null,
      inboxEmail: s.inboxEmail,
      active: s.active,
      jobs: s._count.jobs,
      stages: s.stages.map((st) => JOB_STATUS_LABELS[st.status]),
      /** Materiales u opciones de impresión (D-095), también los desactivados. */
      variants: s.variants,
    }));
  }

  /** Agrega un material u opción de impresión a un tablero (D-095). Queda auditado. */
  @Post("sectors/:id/variants")
  @Roles("OWNER")
  async createVariant(@Param("id") sectorId: string, @ZodBody(createVariantSchema) body: { code: string; name: string }, @CurrentUser() user: AuthUser) {
    const sector = await this.prisma.sector.findUnique({ where: { id: sectorId }, select: { id: true, _count: { select: { variants: true } } } });
    if (!sector) throw new NotFoundException("Ese tablero no existe");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const v = await tx.sectorVariant.create({
          data: { sectorId, code: body.code, name: body.name, sortOrder: sector._count.variants + 1 },
          select: { id: true, code: true, name: true, active: true, sortOrder: true },
        });
        await this.audit.log({ entity: "SectorVariant", entityId: v.id, action: "create", userId: user.id, after: { sectorId, code: v.code, name: v.name } }, tx);
        return v;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ese código ya lo usa otro material");
      throw err;
    }
  }

  /** Cambia el nombre, el código, el orden o lo desactiva (D-095). Desactivado deja de ofrecerse, pero los pedidos lo conservan. */
  @Patch("variants/:id")
  @Roles("OWNER")
  async updateVariant(
    @Param("id") id: string,
    @ZodBody(updateVariantSchema) body: { code?: string; name?: string; active?: boolean; sortOrder?: number },
    @CurrentUser() user: AuthUser,
  ) {
    const before = await this.prisma.sectorVariant.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Ese material no existe");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const v = await tx.sectorVariant.update({ where: { id }, data: body, select: { id: true, code: true, name: true, active: true, sortOrder: true } });
        await this.audit.log(
          { entity: "SectorVariant", entityId: id, action: "update", userId: user.id, before: { code: before.code, name: before.name, active: before.active }, after: { code: v.code, name: v.name, active: v.active } },
          tx,
        );
        return v;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ese código ya lo usa otro material");
      throw err;
    }
  }

  /** Materiales activos de un tablero, para elegir en la app al mandar un trabajo (D-095). */
  @Get("app/sectors/:code/variants")
  @CustomerAuth()
  async appVariants(@Param("code") code: string) {
    if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(code)) throw new BadRequestException("Tablero inválido");
    return this.prisma.sectorVariant.findMany({
      where: { active: true, sector: { code, active: true } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    });
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
    // D-082: de un tablero con sub-servicios se ofrecen los sub-servicios, no el tablero general.
    return this.prisma.sector.findMany({
      where: { active: true, children: { none: { active: true } } },
      orderBy: { name: "asc" },
      select: { code: true, name: true, inboxEmail: true },
    });
  }

  @Get("sectors")
  async sectors(@CurrentUser() user: AuthUser) {
    const allowed = await this.access.allowedSectorIds(user);
    const sectors = await this.prisma.sector.findMany({
      // D-082: se listan los tableros; los sub-servicios se ven dentro del suyo. Quien solo tiene un
      // sub-servicio (por ejemplo Látex) entra por el tablero que lo contiene.
      where: {
        active: true,
        parentId: null,
        ...(allowed === "all" ? {} : { OR: [{ id: { in: allowed } }, { children: { some: { id: { in: allowed }, active: true } } }] }),
      },
      include: { stages: { orderBy: { position: "asc" } }, children: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return sectors.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      services: s.children.filter((c) => allowed === "all" || allowed.includes(c.id)).map((c) => ({ code: c.code, name: c.name })),
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
