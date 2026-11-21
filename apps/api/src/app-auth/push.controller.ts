import { Controller, Get, Headers, HttpCode, Post, Put, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { notificationPrefsSchema, pushSubscriptionSchema, pushUnsubscribeSchema, type NotificationPrefs, type PushSubscriptionInput } from "@viavinilo/contracts";
import { CurrentCustomer, CustomerAuth, type AuthCustomer } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { PrismaService } from "../prisma/prisma.service";

/** Un cliente no necesita más que unos pocos dispositivos; el resto se descarta por el más viejo. */
const MAX_DEVICES = 10;

/**
 * Notificaciones push de la app (D-068). El cliente las prende desde su celular; acá se guarda la
 * suscripción de cada dispositivo y sus preferencias de avisos. El envío lo hace el worker.
 */
@Controller("app")
@CustomerAuth()
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  /** Clave pública para suscribirse. null si el servidor todavía no tiene las claves de push. */
  @Get("push/key")
  key() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || null };
  }

  @Post("push/subscriptions")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async subscribe(@ZodBody(pushSubscriptionSchema) body: PushSubscriptionInput, @CurrentCustomer() customer: AuthCustomer, @Headers("user-agent") userAgent?: string) {
    const data = { customerId: customer.id, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: userAgent?.slice(0, 200) ?? null };
    // Si otro cliente usó antes este mismo navegador, la suscripción pasa a quien tiene la sesión ahora.
    await this.prisma.pushSubscription.upsert({ where: { endpoint: body.endpoint }, create: { endpoint: body.endpoint, ...data }, update: data });
    const extra = await this.prisma.pushSubscription.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } });
    if (extra.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    return { ok: true };
  }

  @Post("push/unsubscribe")
  @HttpCode(200)
  async unsubscribe(@ZodBody(pushUnsubscribeSchema) body: { endpoint: string }, @CurrentCustomer() customer: AuthCustomer) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, customerId: customer.id } });
    return { ok: true };
  }

  /** El cliente elige cómo quiere enterarse: en el celular, por mail o los dos. */
  @Put("notification-prefs")
  async prefs(@ZodBody(notificationPrefsSchema) body: NotificationPrefs, @CurrentCustomer() customer: AuthCustomer) {
    await this.prisma.customer.update({ where: { id: customer.id }, data: { notificationPrefs: body } });
    return body;
  }
}
