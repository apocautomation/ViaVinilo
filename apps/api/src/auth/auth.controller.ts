import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { loginSchema, staffActivateSchema } from "@viavinilo/contracts";
import { ZodBody } from "../common/zod";
import { AuthService } from "./auth.service";
import { StaffActivationService } from "./staff-activation.service";
import { CurrentUser, Public, type AuthUser } from "./decorators";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly activation: StaffActivationService,
  ) {}

  /** Máximo 5 intentos por minuto desde la misma IP. */
  @Public()
  @Post("login")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@ZodBody(loginSchema) body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  /** D-114: crea la contraseña con el link del mail y entra. Máximo 5 intentos por minuto por IP. */
  @Public()
  @Post("activate")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async activate(@ZodBody(staffActivateSchema) body: { token: string; password: string }) {
    const { email } = await this.activation.complete(body.token, body.password);
    return this.auth.login(email, body.password);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
