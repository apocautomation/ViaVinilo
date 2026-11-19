import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DEFAULT_NOTIFICATION_PREFS, notificationPrefsSchema } from "@viavinilo/contracts";
import { CUSTOMER_TOKEN_KIND } from "../auth/decorators";
import { MailerService } from "../mail/mailer.service";
import { PrismaService } from "../prisma/prisma.service";

/** Reglas del código de ingreso a la app (D-038). */
export const LOGIN_CODE = {
  ttlMs: 10 * 60_000,
  maxAttempts: 5,
  /** No se manda otro código al mismo email antes de este tiempo. */
  resendAfterMs: 60_000,
  maxPerHour: 5,
  sessionDays: 30,
} as const;

const INVALID_CODE = "El código no es válido o ya venció. Pedí uno nuevo";

@Injectable()
export class AppAuthService {
  private readonly logger = new Logger("AppAuth");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
  ) {}

  private hash(code: string): string {
    return createHmac("sha256", process.env.JWT_SECRET ?? "").update(code).digest("hex");
  }

  /**
   * Manda un código al email si es de un cliente activo. La respuesta es siempre la misma,
   * exista o no el email, para no revelar quién es cliente.
   */
  async requestCode(email: string): Promise<{ sent: true }> {
    if (!this.mailer.canSend()) {
      throw new ServiceUnavailableException("No pudimos enviar el código. Probá de nuevo más tarde");
    }

    const contact = await this.prisma.customerEmail.findFirst({
      where: { email, customer: { status: "ACTIVE", deletedAt: null } },
      select: { customerId: true },
    });
    if (!contact) return { sent: true };

    const now = Date.now();
    const recent = await this.prisma.customerLoginCode.findMany({
      where: { email, createdAt: { gt: new Date(now - 60 * 60_000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (recent.length >= LOGIN_CODE.maxPerHour || (last && now - last.createdAt.getTime() < LOGIN_CODE.resendAfterMs)) {
      return { sent: true };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.$transaction([
      // Pedir un código nuevo anula los anteriores.
      this.prisma.customerLoginCode.updateMany({
        where: { email, usedAt: null },
        data: { usedAt: new Date(now) },
      }),
      this.prisma.customerLoginCode.create({
        data: {
          customerId: contact.customerId,
          email,
          codeHash: this.hash(code),
          expiresAt: new Date(now + LOGIN_CODE.ttlMs),
        },
      }),
    ]);

    try {
      await this.mailer.send({
        to: email,
        subject: `Tu código para entrar a Via Vinilo: ${code}`,
        text: [
          "¡Hola!",
          "",
          `Tu código para entrar a la app de Via Vinilo es: ${code}`,
          "",
          "Vence en 10 minutos. Si no lo pediste vos, ignorá este mail.",
          "",
          "Via Vinilo · Mayorista gráfico",
        ].join("\n"),
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el código a ${email}: ${(err as Error).message}`);
      throw new ServiceUnavailableException("No pudimos enviar el código. Probá de nuevo más tarde");
    }
    return { sent: true };
  }

  async verifyCode(email: string, code: string) {
    const entry = await this.prisma.customerLoginCode.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!entry || entry.attempts >= LOGIN_CODE.maxAttempts) throw new UnauthorizedException(INVALID_CODE);

    const expected = Buffer.from(entry.codeHash, "hex");
    const given = Buffer.from(this.hash(code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      await this.prisma.customerLoginCode.update({ where: { id: entry.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException(INVALID_CODE);
    }

    // Se marca usado solo si nadie lo usó en el medio (dos pestañas a la vez).
    const { count } = await this.prisma.customerLoginCode.updateMany({
      where: { id: entry.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException(INVALID_CODE);

    const customer = await this.prisma.customer.findFirst({
      where: { id: entry.customerId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new UnauthorizedException("Tu cuenta no está activa. Escribinos por WhatsApp");

    const accessToken = await this.jwt.signAsync(
      { sub: customer.id, kind: CUSTOMER_TOKEN_KIND },
      { expiresIn: `${LOGIN_CODE.sessionDays}d` },
    );
    return { accessToken, customer: await this.me(customer.id) };
  }

  /** Lo que el cliente ve de su propia ficha. Nunca las notas internas ni los datos de control. */
  async me(customerId: string) {
    const c = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      include: {
        emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true, isPrimary: true } },
        phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { phone: true, isPrimary: true } },
      },
    });
    const prefs = notificationPrefsSchema.safeParse(c.notificationPrefs);
    return {
      customerNumber: c.customerNumber,
      firstName: c.firstName,
      lastName: c.lastName,
      businessName: c.businessName,
      emails: c.emails,
      phones: c.phones,
      notificationPrefs: prefs.success ? prefs.data : DEFAULT_NOTIFICATION_PREFS,
    };
  }
}
