import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@viavinilo/contracts";
import { PrismaService } from "../prisma/prisma.service";
import {
  CUSTOMER_TOKEN_KIND,
  IS_CUSTOMER_ROUTE,
  IS_PUBLIC,
  ROLES,
  type AuthCustomer,
  type AuthUser,
} from "./decorators";

/**
 * Exige un token válido en todas las rutas salvo las @Public().
 * En cada pedido se relee el usuario: si lo desactivan o le cambian los roles, aplica al instante.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException("Iniciá sesión para continuar");

    let sub: string;
    let kind: string | undefined;
    try {
      ({ sub, kind } = await this.jwt.verifyAsync<{ sub: string; kind?: string }>(token));
    } catch {
      throw new UnauthorizedException("La sesión venció. Iniciá sesión de nuevo");
    }

    // D-038: la sesión de un cliente solo sirve en las rutas de la app, y la del personal solo en el ERP.
    const isCustomerRoute = this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_ROUTE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isCustomerRoute) {
      if (kind !== CUSTOMER_TOKEN_KIND) throw new UnauthorizedException("Iniciá sesión para continuar");
      const customer = await this.prisma.customer.findFirst({
        where: { id: sub, status: "ACTIVE", deletedAt: null },
        select: { id: true, customerNumber: true },
      });
      if (!customer) throw new UnauthorizedException("Tu cuenta no está activa. Escribinos por WhatsApp");
      req.customer = customer satisfies AuthCustomer;
      return true;
    }
    if (kind === CUSTOMER_TOKEN_KIND) throw new UnauthorizedException("Iniciá sesión para continuar");

    const user = await this.prisma.user.findFirst({ where: { id: sub, active: true, deletedAt: null } });
    if (!user) throw new UnauthorizedException("Tu usuario no está activo");

    req.user = { id: user.id, email: user.email, name: user.name, roles: user.roles } satisfies AuthUser;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.roles.includes("OWNER") || required.some((r) => user.roles.includes(r))) return true;
    throw new ForbiddenException("No tenés permiso para hacer esto");
  }
}
