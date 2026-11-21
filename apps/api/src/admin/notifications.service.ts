import { Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";

export interface Notice {
  kind: "needs_human" | "unattended" | "unread" | "file_problem" | "unquoted" | "pending_signup";
  /** urgent: hay que atenderlo ya · normal: para tener en cuenta */
  level: "urgent" | "normal";
  title: string;
  detail: string;
  href: string;
  count: number;
}

/**
 * Avisos de la campanita (D-067). Se calculan al momento con lo que hay en el sistema: no se guarda
 * una bandeja aparte. Atención y el dueño ven todo; producción, solo los pedidos de sus tableros.
 * Los tiempos ("sin atención hace más de…") se configuran en Configuración → Avisos.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
  ) {}

  async forUser(user: AuthUser, now = new Date()): Promise<{ total: number; items: Notice[] }> {
    const settings = await this.admin.alertSettings();
    const seesAll = user.roles.includes("OWNER") || user.roles.includes("ATTENTION");
    const sectorIds = seesAll ? null : (await this.prisma.userSector.findMany({ where: { userId: user.id }, select: { sectorId: true } })).map((s) => s.sectorId);
    const jobScope = sectorIds ? { sectorId: { in: sectorIds } } : {};
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const items: Notice[] = [];

    if (seesAll) {
      const [needsHuman, unattended, unread, pendingSignups] = await Promise.all([
        this.prisma.conversation.count({ where: { needsHuman: true } }),
        this.prisma.conversation.count({ where: { staffUnread: { gt: 0 }, lastMessageAt: { lt: ago(settings.unansweredMinutes * 60_000) } } }),
        this.prisma.conversation.count({ where: { staffUnread: { gt: 0 } } }),
        this.prisma.customer.count({ where: { status: "PENDING", deletedAt: null, createdAt: { lt: ago(settings.pendingSignupHours * 3_600_000) } } }),
      ]);
      if (needsHuman) {
        items.push({ kind: "needs_human", level: "urgent", title: plural(needsHuman, "chat pide un asesor", "chats piden un asesor"), detail: "El bot los derivó o el cliente pidió hablar con una persona.", href: "/ventas/conversaciones", count: needsHuman });
      }
      if (unattended) {
        items.push({ kind: "unattended", level: "urgent", title: plural(unattended, "chat sin atención", "chats sin atención"), detail: `Tienen mensajes sin leer hace más de ${settings.unansweredMinutes} minutos.`, href: "/ventas/conversaciones", count: unattended });
      }
      if (unread - unattended > 0) {
        items.push({ kind: "unread", level: "normal", title: plural(unread - unattended, "chat con mensajes nuevos", "chats con mensajes nuevos"), detail: "Mensajes de clientes sin leer.", href: "/ventas/conversaciones", count: unread - unattended });
      }
      if (pendingSignups) {
        items.push({ kind: "pending_signup", level: "normal", title: plural(pendingSignups, "alta pendiente", "altas pendientes"), detail: `Sin aprobar hace más de ${settings.pendingSignupHours} horas.`, href: "/ventas/clientes", count: pendingSignups });
      }
    }

    const [fileProblems, unquoted] = await Promise.all([
      this.prisma.jobOrder.count({ where: { ...jobScope, deletedAt: null, status: "RECEIVED", fileCheck: { path: ["verdict"], equals: "error" } } }),
      this.prisma.jobOrder.count({ where: { ...jobScope, deletedAt: null, status: "RECEIVED", createdAt: { lt: ago(settings.unquotedHours * 3_600_000) } } }),
    ]);
    if (fileProblems) {
      items.push({ kind: "file_problem", level: "urgent", title: plural(fileProblems, "pedido con archivo con problema", "pedidos con archivo con problema"), detail: "El control automático encontró resolución muy baja.", href: "/ventas/pedidos", count: fileProblems });
    }
    if (unquoted) {
      items.push({ kind: "unquoted", level: "normal", title: plural(unquoted, "pedido sin cotizar", "pedidos sin cotizar"), detail: `En "Archivo recibido" hace más de ${settings.unquotedHours} horas.`, href: "/ventas/pedidos", count: unquoted });
    }

    const order = { urgent: 0, normal: 1 };
    items.sort((a, b) => order[a.level] - order[b.level]);
    return { total: items.reduce((n, i) => n + i.count, 0), items };
  }
}
