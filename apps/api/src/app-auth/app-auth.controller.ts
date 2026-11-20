import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { completeActivationSchema, customerLoginSchema, requestActivationSchema } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, Public, type AuthCustomer } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { ActivationService } from "./activation.service";
import { AppAuthService } from "./app-auth.service";

/** Ingreso de los clientes a la app con email y contraseña (D-039). No hay autoalta (D-038). */
@Controller("app")
export class AppAuthController {
  constructor(
    private readonly auth: AppAuthService,
    private readonly activation: ActivationService,
  ) {}

  /** Máximo 5 intentos por minuto desde la misma IP. */
  @Public()
  @Post("auth/login")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@ZodBody(customerLoginSchema) body: { user: string; password: string }) {
    return this.auth.login(body.user, body.password);
  }

  /** /activar: el cliente pide el link para crear su contraseña (D-049). Siempre responde lo mismo. */
  @Public()
  @Post("auth/activation/request")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestActivation(@ZodBody(requestActivationSchema) body: { email: string }) {
    return this.activation.request(body.email);
  }

  /** El cliente crea su contraseña con el link y queda con la sesión iniciada. */
  @Public()
  @Post("auth/activation/complete")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async completeActivation(@ZodBody(completeActivationSchema) body: { token: string; password: string }) {
    const { customerId } = await this.activation.complete(body.token, body.password);
    return this.auth.sessionFor(customerId);
  }

  @CustomerAuth()
  @Get("me")
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.auth.me(customer.id);
  }
}
