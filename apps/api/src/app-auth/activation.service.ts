import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password";

/** Reglas del link para crear la contraseña de la app (D-049). */
export const ACTIVATION = {
  ttlMs: 48 * 60 * 60_000,
  /** El cliente no puede pedir otro link al mismo email antes de esto. */
  resendAfterMs: 2 * 60_000,
  maxPerDay: 5,
} as const;

type Kind = "invite" | "self";

const appUrl = () => (process.env.APP_PUBLIC_URL ?? "http://localhost:3002").replace(/\/$/, "");
const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/** Texto del mail. Español rioplatense, sin promesas (CLAUDE.md). */
function emailText(kind: Kind, name: string | null, link: string) {
  const hola = name ? `¡Hola ${name}!` : "¡Hola!";
  const intro =
    kind === "invite"
      ? "Ya podés seguir tus trabajos de Via Vinilo desde la app: estado, precio y cuándo podés retirar cada pedido."
      : "Pediste crear o cambiar la contraseña de la app de Via Vinilo.";
  return [
    hola,
    "",
    intro,
    "",
    `Creá tu contraseña desde este link (vale 48 horas):`,
    link,
    "",
    "Después entrás a https://viavinilo.tech con tu email o tu celular y esa contraseña.",
    "",
    "Si no lo pediste vos, ignorá este mail.",
    "",
    "Via Vinilo · Mayorista gráfico",
  ].join("\n");
}

@Injectable()
export class ActivationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un link para un cliente y deja el mail en la cola (`OutboundEmail`). El worker lo manda
   * despacio. Anula los links anteriores sin usar del mismo cliente.
   */
  async createAndQueue(customer: { id: string; firstName: string | null }, email: string, kind: Kind) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.appActivation.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.appActivation.create({
        data: {
          customerId: customer.id,
          email,
          tokenHash: sha256(token),
          kind,
          expiresAt: new Date(now.getTime() + ACTIVATION.ttlMs),
        },
      }),
      this.prisma.outboundEmail.create({
        data: {
          to: email,
          subject: kind === "invite" ? "Via Vinilo · Tu acceso a la app" : "Via Vinilo · Creá tu contraseña",
          text: emailText(kind, customer.firstName, `${appUrl()}/activar/${token}`),
          kind: `activation-${kind}`,
          customerId: customer.id,
        },
      }),
    ]);
  }

  /** Pedido público desde /activar. Siempre responde lo mismo, sea o no un email de un cliente. */
  async request(email: string): Promise<{ sent: true }> {
    const contact = await this.prisma.customerEmail.findUnique({
      where: { email },
      select: { customer: { select: { id: true, firstName: true, status: true, deletedAt: true } } },
    });
    const customer = contact?.customer;
    if (!customer || customer.status !== "ACTIVE" || customer.deletedAt) return { sent: true };

    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const recent = await this.prisma.appActivation.findMany({
      where: { email, kind: "self", createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (recent.length >= ACTIVATION.maxPerDay || (last && Date.now() - last.createdAt.getTime() < ACTIVATION.resendAfterMs)) {
      return { sent: true };
    }
    await this.createAndQueue(customer, email, "self");
    return { sent: true };
  }

  /** El cliente crea su contraseña. El link sirve una sola vez y vence a las 48 h. */
  async complete(token: string, password: string): Promise<{ customerId: string }> {
    const invalid = new UnauthorizedException("El link no es válido o ya venció. Pedí uno nuevo en viavinilo.tech/activar");
    const entry = await this.prisma.appActivation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!entry || entry.usedAt || entry.expiresAt.getTime() < Date.now()) throw invalid;

    const customer = await this.prisma.customer.findFirst({
      where: { id: entry.customerId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new UnauthorizedException("Tu cuenta no está activa. Escribinos por WhatsApp");

    const appPasswordHash = await hashPassword(password);
    const used = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.appActivation.updateMany({
        where: { id: entry.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.customer.update({
        where: { id: customer.id },
        data: { appPasswordHash, appPasswordSetAt: new Date() },
      });
      await tx.auditLog.create({
        data: { entity: "Customer", entityId: customer.id, action: "app_password_by_link", after: { kind: entry.kind } },
      });
      return true;
    });
    if (!used) throw invalid;
    return { customerId: customer.id };
  }
}
