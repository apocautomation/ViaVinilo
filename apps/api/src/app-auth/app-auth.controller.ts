import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { requestLoginCodeSchema, verifyLoginCodeSchema } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, Public, type AuthCustomer } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { AppAuthService } from "./app-auth.service";

/** Ingreso de los clientes a la app con un código al email (D-016, D-038). No hay autoalta. */
@Controller("app")
export class AppAuthController {
  constructor(private readonly auth: AppAuthService) {}

  /** Máximo 5 pedidos por minuto desde la misma IP. */
  @Public()
  @Post("auth/request-code")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestCode(@ZodBody(requestLoginCodeSchema) body: { email: string }) {
    return this.auth.requestCode(body.email);
  }

  @Public()
  @Post("auth/verify")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@ZodBody(verifyLoginCodeSchema) body: { email: string; code: string }) {
    return this.auth.verifyCode(body.email, body.code);
  }

  @CustomerAuth()
  @Get("me")
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.auth.me(customer.id);
  }
}
