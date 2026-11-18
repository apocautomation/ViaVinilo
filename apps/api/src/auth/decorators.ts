import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { UserRole } from "@viavinilo/contracts";

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";

/** Ruta sin login (por ejemplo /health y /auth/login). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Roles que pueden usar la ruta. OWNER siempre puede (D-017). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
