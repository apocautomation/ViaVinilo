import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "./password";

/**
 * Invitación del equipo al ERP (D-114): el dueño crea el usuario sin contraseña y el sistema le manda un
 * mail con un link para que la cree la persona. Nadie más la conoce, ni el dueño ni quien desarrolla.
 * Mismo esquema que el link de la app de clientes (D-049): se guarda solo el hash, sirve una vez y vence.
 */
export const STAFF_ACTIVATION = { ttlMs: 72 * 60 * 60_000 } as const;

const erpUrl = () => (process.env.ERP_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

function emailText(name: string, link: string) {
  return [
    `¡Hola ${name}!`,
    "",
    "Te dieron acceso al sistema de Via Vinilo (tableros de producción, pedidos y clientes).",
    "",
    "Creá tu contraseña desde este link (vale 72 horas y sirve una sola vez):",
    link,
    "",
    `Después entrás a ${erpUrl()} con este email y esa contraseña.`,
    "",
    "Si no esperabas este mail, ignoralo.",
    "",
    "Via Vinilo · Mayorista gráfico",
  ].join("\n");
}

@Injectable()
export class StaffActivationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea el link, anula los anteriores sin usar y deja el mail en la cola (lo manda el worker). */
  async createAndQueue(user: { id: string; name: string; email: string }, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await db.userActivation.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await db.userActivation.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + STAFF_ACTIVATION.ttlMs) } });
    await db.outboundEmail.create({
      data: { to: user.email, subject: "Via Vinilo · Tu acceso al sistema", text: emailText(user.name, `${erpUrl()}/activar/${token}`), kind: "staff-invite" },
    });
  }

  /** La persona crea su contraseña. El link sirve una sola vez y vence a las 72 h. */
  async complete(token: string, password: string): Promise<{ email: string }> {
    const invalid = new UnauthorizedException("El link no es válido o ya venció. Pedile al dueño que te mande otro.");
    const entry = await this.prisma.userActivation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!entry || entry.usedAt || entry.expiresAt.getTime() < Date.now()) throw invalid;
    const user = await this.prisma.user.findFirst({ where: { id: entry.userId, active: true, deletedAt: null }, select: { id: true, email: true } });
    if (!user) throw new UnauthorizedException("Tu usuario no está activo. Hablá con el dueño.");

    const passwordHash = await hashPassword(password);
    const used = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.userActivation.updateMany({ where: { id: entry.id, usedAt: null }, data: { usedAt: new Date() } });
      if (count === 0) return false;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Queda que la creó la persona con su link; nunca la contraseña.
      await tx.auditLog.create({ data: { entity: "User", entityId: user.id, action: "password_by_link", userId: user.id } });
      return true;
    });
    if (!used) throw invalid;
    return { email: user.email };
  }

  /** Si tiene una invitación vigente sin usar (para mostrar "Esperando que cree su contraseña"). */
  async pending(userIds: string[]): Promise<Set<string>> {
    const rows = await this.prisma.userActivation.findMany({
      where: { userId: { in: userIds }, usedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }
}
