import { Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { appChatMessageSchema, listConversationsSchema, sendMessageSchema, type MessageChannel } from "@viavinilo/contracts";
import { CurrentCustomer, CurrentUser, CustomerAuth, Roles, type AuthCustomer, type AuthUser } from "../auth/decorators";
import { ZodBody, ZodQuery } from "../common/zod";
import { ConversationsService } from "./conversations.service";

/** Bandeja de Conversaciones del ERP (D-041, D-045). La ven atención y el dueño. */
@Controller("conversations")
@Roles("ATTENTION")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@ZodQuery(listConversationsSchema) query: Parameters<ConversationsService["list"]>[0]) {
    return this.conversations.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.conversations.get(id);
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@Param("id") id: string) {
    return this.conversations.markRead(id);
  }

  @Post(":id/messages")
  send(
    @Param("id") id: string,
    @ZodBody(sendMessageSchema) body: { text: string; channel: MessageChannel },
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversations.send(id, body, user.id);
  }
}

/** Pestaña Chat de la app de clientes (D-045). */
@Controller("app/chat")
@CustomerAuth()
export class AppChatController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  thread(@CurrentCustomer() customer: AuthCustomer) {
    return this.conversations.customerThread(customer.id);
  }

  @Get("unread")
  unread(@CurrentCustomer() customer: AuthCustomer) {
    return this.conversations.customerUnread(customer.id);
  }

  /** Máximo 20 mensajes por minuto por IP (evita que un cliente llene la bandeja). */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  send(@ZodBody(appChatMessageSchema) body: { text: string }, @CurrentCustomer() customer: AuthCustomer) {
    return this.conversations.customerSend(customer.id, body.text);
  }
}
