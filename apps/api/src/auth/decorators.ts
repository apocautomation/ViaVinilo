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

/** Ruta de la app de clientes: exige la sesión de un cliente activo, no la del personal (D-038). */
export const IS_CUSTOMER_ROUTE = "isCustomerRoute";
export const CustomerAuth = () => SetMetadata(IS_CUSTOMER_ROUTE, true);

/** Tipo de sesión que va en el token. Los tokens del personal no llevan `kind`. */
export const CUSTOMER_TOKEN_KIND = "customer";

export interface AuthCustomer {
  id: string;
  customerNumber: number;
}

export const CurrentCustomer = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthCustomer => {
  return ctx.switchToHttp().getRequest().customer;
});
