import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { customerLoginSchema } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, Public, type AuthCustomer } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { AppAuthService } from "./app-auth.service";

/** Ingreso de los clientes a la app con email y contraseña (D-039). No hay autoalta (D-038). */
@Controller("app")
export class AppAuthController {
  constructor(private readonly auth: AppAuthService) {}

  /** Máximo 5 intentos por minuto desde la misma IP. */
  @Public()
  @Post("auth/login")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@ZodBody(customerLoginSchema) body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @CustomerAuth()
  @Get("me")
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.auth.me(customer.id);
  }
}
