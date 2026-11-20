import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DEFAULT_NOTIFICATION_PREFS, normalizePhone, notificationPrefsSchema } from "@viavinilo/contracts";
import { CUSTOMER_TOKEN_KIND } from "../auth/decorators";
import { verifyPassword } from "../auth/password";
import { PrismaService } from "../prisma/prisma.service";

/** Sesión del cliente en la app (D-038). */
export const CUSTOMER_SESSION_DAYS = 30;

/** Hash fijo para comparar cuando el email no existe y que la respuesta tarde lo mismo. */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const INVALID = "Los datos no son correctos. Revisá tu email o celular y la contraseña";

@Injectable()
export class AppAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Ingreso con email **o celular** y contraseña (D-039, D-049). Sirve cualquier email o teléfono de
   * la ficha. Dato inexistente, contraseña mal, cliente no activo o sin contraseña responden lo mismo.
   */
  async login(user: string, password: string) {
    const select = { customer: { select: { id: true, status: true, deletedAt: true, appPasswordHash: true } } };
    const value = user.trim();
    let contact: { customer: { id: string; status: string; deletedAt: Date | null; appPasswordHash: string | null } } | null = null;
    if (value.includes("@")) {
      contact = await this.prisma.customerEmail.findUnique({ where: { email: value.toLowerCase() }, select });
    } else {
      const phone = normalizePhone(value);
      if (phone) contact = await this.prisma.customerPhone.findUnique({ where: { phone }, select });
    }
    const customer = contact?.customer;
    const ok = await verifyPassword(password, customer?.appPasswordHash ?? DUMMY_HASH);
    if (!customer || !customer.appPasswordHash || !ok || customer.status !== "ACTIVE" || customer.deletedAt) {
      throw new UnauthorizedException(INVALID);
    }
    return this.sessionFor(customer.id);
  }

  /** Token de sesión del cliente (30 días) y sus datos. */
  async sessionFor(customerId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: customerId, kind: CUSTOMER_TOKEN_KIND },
      { expiresIn: `${CUSTOMER_SESSION_DAYS}d` },
    );
    return { accessToken, customer: await this.me(customerId) };
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
