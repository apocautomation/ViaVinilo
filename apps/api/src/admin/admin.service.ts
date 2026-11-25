import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, type UserRole } from "@prisma/client";
import { alertSettingsSchema, DEFAULT_ALERT_SETTINGS, sectorCodeFromName, type AlertSettings } from "@viavinilo/contracts";
import { AuditService } from "../audit/audit.service";
import { hashPassword } from "../auth/password";
import { StaffActivationService } from "../auth/staff-activation.service";
import { PrismaService } from "../prisma/prisma.service";

const userSelect = {
  id: true,
  name: true,
  email: true,
  roles: true,
  canSeeBilling: true,
  active: true,
  createdAt: true,
  passwordHash: true,
  sectors: { select: { sector: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

export const ALERTS_SETTING_KEY = "alerts";

/**
 * Configuración del ERP (D-067): usuarios, máquinas, motivos de error y avisos. Todo lo hace el
 * dueño y queda en auditoría. Nunca se guarda ni se devuelve una contraseña en claro.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activation: StaffActivationService,
  ) {}

  // ───────────── Usuarios ─────────────

  /** Nunca sale el hash: solo si ya tiene contraseña y si tiene una invitación vigente (D-114). */
  private shape(u: Prisma.UserGetPayload<{ select: typeof userSelect }>, invitePending = false) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.roles,
      canSeeBilling: u.canSeeBilling,
      active: u.active,
      createdAt: u.createdAt,
      sectors: u.sectors.map((s) => s.sector),
      loginReady: u.passwordHash !== null,
      invitePending,
    };
  }

  async users() {
    const rows = await this.prisma.user.findMany({ where: { deletedAt: null }, orderBy: [{ active: "desc" }, { name: "asc" }], select: userSelect });
    const pending = await this.activation.pending(rows.map((u) => u.id));
    return rows.map((u) => this.shape(u, pending.has(u.id)));
  }

  /**
   * Sin contraseña (lo recomendado, D-114), la persona recibe un mail con un link para crearla. Con
   * contraseña, se la pasa el dueño en persona.
   */
  async createUser(input: { name: string; email: string; roles: UserRole[]; sectorIds: string[]; canSeeBilling?: boolean; password?: string }, actorId: string) {
    const passwordHash = input.password ? await hashPassword(input.password) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            roles: [...new Set(input.roles)],
            canSeeBilling: input.canSeeBilling ?? false,
            passwordHash,
            sectors: { create: input.sectorIds.map((sectorId) => ({ sectorId })) },
          },
          select: userSelect,
        });
        await this.audit.log(
          { entity: "User", entityId: user.id, action: "create", userId: actorId, after: { email: user.email, roles: user.roles, sectors: input.sectorIds.length, invited: !passwordHash } },
          tx,
        );
        if (!passwordHash) await this.activation.createAndQueue(user, tx);
        return this.shape(user, !passwordHash);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ya hay un usuario con ese email");
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") throw new UnprocessableEntityException("Uno de los tableros no existe");
      throw err;
    }
  }

  /** Siempre tiene que quedar al menos un dueño activo, y nadie se saca a sí mismo el acceso. */
  private async guardOwners(targetId: string, actorId: string, next: { roles?: UserRole[]; active?: boolean }) {
    const target = await this.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
    if (!target) throw new NotFoundException("No encontramos ese usuario");
    const willBeOwner = (next.roles ?? target.roles).includes("OWNER") && (next.active ?? target.active);
    const isOwnerNow = target.roles.includes("OWNER") && target.active;
    if (isOwnerNow && !willBeOwner) {
      if (targetId === actorId) throw new UnprocessableEntityException("No podés sacarte a vos mismo el rol de dueño ni desactivarte");
      const others = await this.prisma.user.count({ where: { id: { not: targetId }, active: true, deletedAt: null, roles: { has: "OWNER" } } });
      if (others === 0) throw new UnprocessableEntityException("Tiene que quedar al menos un dueño activo");
    }
    return target;
  }

  async updateUser(id: string, input: { name?: string; email?: string; roles?: UserRole[]; sectorIds?: string[]; canSeeBilling?: boolean; active?: boolean }, actorId: string) {
    const before = await this.guardOwners(id, actorId, input);
    const { sectorIds, ...data } = input;
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (sectorIds) {
          await tx.userSector.deleteMany({ where: { userId: id } });
          await tx.userSector.createMany({ data: sectorIds.map((sectorId) => ({ userId: id, sectorId })) });
        }
        const user = await tx.user.update({ where: { id }, data: { ...data, ...(data.roles ? { roles: [...new Set(data.roles)] } : {}) }, select: userSelect });
        await this.audit.log(
          {
            entity: "User",
            entityId: id,
            action: "update",
            userId: actorId,
            before: { name: before.name, email: before.email, roles: before.roles, canSeeBilling: before.canSeeBilling, active: before.active },
            after: { name: user.name, email: user.email, roles: user.roles, canSeeBilling: user.canSeeBilling, active: user.active, ...(sectorIds ? { sectors: sectorIds.length } : {}) },
          },
          tx,
        );
        return this.shape(user);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ya hay un usuario con ese email");
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") throw new UnprocessableEntityException("Uno de los tableros no existe");
      throw err;
    }
  }

  /** Vuelve a mandar la invitación (D-114): anula el link anterior. Sirve también para "olvidé la contraseña". */
  async invite(id: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true, email: true, active: true } });
    if (!user) throw new NotFoundException("No encontramos ese usuario");
    if (!user.active) throw new UnprocessableEntityException("El usuario está desactivado: activalo antes de invitarlo");
    await this.prisma.$transaction(async (tx) => {
      await this.activation.createAndQueue(user, tx);
      await this.audit.log({ entity: "User", entityId: id, action: "invite", userId: actorId }, tx);
    });
    return { ok: true };
  }

  async setPassword(id: string, password: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException("No encontramos ese usuario");
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      // En la auditoría queda que se cambió y quién lo hizo; nunca la contraseña.
      await this.audit.log({ entity: "User", entityId: id, action: "set_password", userId: actorId }, tx);
    });
    return { ok: true };
  }

  // ───────────── Máquinas ─────────────

  async machines() {
    const rows = await this.prisma.machine.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { sectors: { select: { sector: { select: { id: true, name: true } } } }, _count: { select: { jobs: true } } },
    });
    return rows.map((m) => ({ id: m.id, name: m.name, active: m.active, jobs: m._count.jobs, sectors: m.sectors.map((s) => s.sector) }));
  }

  async createMachine(input: { name: string; sectorIds: string[] }, actorId: string) {
    try {
      const m = await this.prisma.$transaction(async (tx) => {
        const machine = await tx.machine.create({ data: { name: input.name, sectors: { create: input.sectorIds.map((sectorId) => ({ sectorId })) } } });
        await this.audit.log({ entity: "Machine", entityId: machine.id, action: "create", userId: actorId, after: { name: machine.name } }, tx);
        return machine;
      });
      return { id: m.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ya hay una máquina con ese nombre");
      throw err;
    }
  }

  async updateMachine(id: string, input: { name?: string; sectorIds?: string[]; active?: boolean }, actorId: string) {
    const before = await this.prisma.machine.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("No encontramos esa máquina");
    const { sectorIds, ...data } = input;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (sectorIds) {
          await tx.machineSector.deleteMany({ where: { machineId: id } });
          await tx.machineSector.createMany({ data: sectorIds.map((sectorId) => ({ machineId: id, sectorId })) });
        }
        const after = await tx.machine.update({ where: { id }, data });
        await this.audit.log(
          { entity: "Machine", entityId: id, action: "update", userId: actorId, before: { name: before.name, active: before.active }, after: { name: after.name, active: after.active } },
          tx,
        );
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ya hay una máquina con ese nombre");
      throw err;
    }
  }

  // ───────────── Motivos de error ─────────────

  errorReasons() {
    return this.prisma.fileErrorReason.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }], select: { id: true, code: true, label: true, active: true } });
  }

  async createErrorReason(label: string, actorId: string) {
    const last = await this.prisma.fileErrorReason.aggregate({ _max: { sortOrder: true } });
    try {
      const r = await this.prisma.fileErrorReason.create({ data: { code: sectorCodeFromName(label), label, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
      await this.audit.log({ entity: "FileErrorReason", entityId: r.id, action: "create", userId: actorId, after: { label } });
      return { id: r.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new ConflictException("Ese motivo ya existe");
      throw err;
    }
  }

  async updateErrorReason(id: string, input: { label?: string; active?: boolean }, actorId: string) {
    const before = await this.prisma.fileErrorReason.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("No encontramos ese motivo");
    const after = await this.prisma.fileErrorReason.update({ where: { id }, data: input });
    await this.audit.log({ entity: "FileErrorReason", entityId: id, action: "update", userId: actorId, before: { label: before.label, active: before.active }, after: { label: after.label, active: after.active } });
    return { ok: true };
  }

  // ───────────── Avisos de la campanita ─────────────

  async alertSettings(): Promise<AlertSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: ALERTS_SETTING_KEY } });
    const parsed = alertSettingsSchema.safeParse(row?.value);
    return parsed.success ? parsed.data : DEFAULT_ALERT_SETTINGS;
  }

  async setAlertSettings(value: AlertSettings, actorId: string) {
    const before = await this.alertSettings();
    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: ALERTS_SETTING_KEY },
        create: { key: ALERTS_SETTING_KEY, value, updatedById: actorId },
        update: { value, updatedById: actorId },
      });
      await this.audit.log({ entity: "AppSetting", entityId: ALERTS_SETTING_KEY, action: "update", userId: actorId, before, after: value }, tx);
    });
    return value;
  }
}
