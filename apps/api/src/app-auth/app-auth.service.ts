import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DEFAULT_NOTIFICATION_PREFS, notificationPrefsSchema } from "@viavinilo/contracts";
import { CUSTOMER_TOKEN_KIND } from "../auth/decorators";
import { verifyPassword } from "../auth/password";
import { PrismaService } from "../prisma/prisma.service";

/** Sesión del cliente en la app (D-038). */
export const CUSTOMER_SESSION_DAYS = 30;

/** Hash fijo para comparar cuando el email no existe y que la respuesta tarde lo mismo. */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const INVALID = "Email o contraseña incorrectos";

@Injectable()
export class AppAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Ingreso con email y contraseña (D-039). Sirve cualquier email de la ficha. Email inexistente,
   * contraseña mal, cliente no activo o sin contraseña cargada responden lo mismo.
   */
  async login(email: string, password: string) {
    const contact = await this.prisma.customerEmail.findUnique({
      where: { email },
      select: {
        customer: {
          select: { id: true, status: true, deletedAt: true, appPasswordHash: true },
        },
      },
    });
    const customer = contact?.customer;
    const ok = await verifyPassword(password, customer?.appPasswordHash ?? DUMMY_HASH);
    if (!customer || !customer.appPasswordHash || !ok || customer.status !== "ACTIVE" || customer.deletedAt) {
      throw new UnauthorizedException(INVALID);
    }
    const accessToken = await this.jwt.signAsync(
      { sub: customer.id, kind: CUSTOMER_TOKEN_KIND },
      { expiresIn: `${CUSTOMER_SESSION_DAYS}d` },
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
