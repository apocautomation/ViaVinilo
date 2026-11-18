import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@viavinilo/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC, ROLES, type AuthUser } from "./decorators";

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
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      throw new UnauthorizedException("La sesión venció. Iniciá sesión de nuevo");
    }

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
