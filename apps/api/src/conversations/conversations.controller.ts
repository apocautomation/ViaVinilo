import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  appChatMessageSchema,
  appUploadSchema,
  botToggleSchema,
  listConversationsSchema,
  MAX_FILES_PER_MESSAGE,
  MAX_UPLOAD_BYTES,
  sendMessageSchema,
  staffUploadSchema,
  type MessageChannel,
  type PickupBranch,
  type SectorCode,
} from "@viavinilo/contracts";
import { ConversationFilesService, type UploadedFileLike } from "./conversation-files.service";
import { CurrentCustomer, CurrentUser, CustomerAuth, Roles, type AuthCustomer, type AuthUser } from "../auth/decorators";
import { ZodBody, ZodQuery } from "../common/zod";
import { ConversationsService } from "./conversations.service";

/** Bandeja de Conversaciones del ERP (D-041, D-045). La ven atención y el dueño. */
@Controller("conversations")
@Roles("ATTENTION")
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly files: ConversationFilesService,
  ) {}

  /** El asesor responde con archivos (D-062): por la app o por mail (hasta 20 MB por mail). */
  @Post(":id/files")
  @UseInterceptors(FilesInterceptor("files", MAX_FILES_PER_MESSAGE, { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  sendFiles(
    @Param("id") id: string,
    @UploadedFiles() files: UploadedFileLike[] | undefined,
    @ZodBody(staffUploadSchema) body: { text?: string; channel: MessageChannel },
    @CurrentUser() user: AuthUser,
  ) {
    return this.files.staffUpload(id, files ?? [], body, user.id);
  }

  /** Descarga un adjunto del hilo. */
  @Get(":id/files/:messageId/:index")
  file(@Param("id") id: string, @Param("messageId") messageId: string, @Param("index", ParseIntPipe) index: number) {
    return this.files.staffFile(id, messageId, index);
  }

  @Get()
  list(@ZodQuery(listConversationsSchema) query: Parameters<ConversationsService["list"]>[0]) {
    return this.conversations.list(query);
  }

  /** Bot (D-057): en cuántos chats está prendido y si el servidor tiene IA configurada. */
  @Get("bot")
  botStatus() {
    return this.conversations.botStatus();
  }

  /** Avisos automáticos de estado al cliente (D-060). */
  @Get("notices")
  noticesStatus() {
    return this.conversations.noticesStatus();
  }

  /** Prender o apagar los avisos: solo el dueño, porque salen mails reales a los clientes. */
  @Put("notices")
  @Roles("OWNER")
  setNotices(@ZodBody(botToggleSchema) body: { enabled: boolean }, @CurrentUser() user: AuthUser) {
    return this.conversations.setNotices(body.enabled, user.id);
  }

  /** Prende el bot en todos los chats de clientes de una vez (D-058, queda en auditoría). */
  @Post("bot/on")
  @HttpCode(200)
  turnBotOn(@CurrentUser() user: AuthUser) {
    return this.conversations.turnBotOnEverywhere(user.id);
  }

  /** Apaga el bot en todos los chats de una vez (queda en auditoría). */
  @Post("bot/off")
  @HttpCode(200)
  turnBotOff(@CurrentUser() user: AuthUser) {
    return this.conversations.turnBotOffEverywhere(user.id);
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

  /** Prender o apagar el bot en un chat (D-056). */
  @Post(":id/bot")
  @HttpCode(200)
  setChatBot(@Param("id") id: string, @ZodBody(botToggleSchema) body: { enabled: boolean }) {
    return this.conversations.setBotForChat(id, body.enabled);
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
  constructor(
    private readonly conversations: ConversationsService,
    private readonly files: ConversationFilesService,
  ) {}

  /** El cliente manda su archivo por el chat (D-062): se crea el pedido en el tablero del servicio. */
  @Post("files")
  @UseGuards(ThrottlerGuard)
  // Subidas por minuto por cliente. Configurable para los tests, que suben muchos archivos seguidos.
  @Throttle({ default: { limit: Number(process.env.APP_UPLOADS_PER_MINUTE ?? 10), ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @ZodBody(appUploadSchema) body: { sector?: SectorCode; job?: number; note?: string; pickupBranch?: PickupBranch; widthCm?: number; heightCm?: number; copies?: number },
    @CurrentCustomer() customer: AuthCustomer,
  ) {
    return this.files.customerUpload(customer.id, file, body);
  }

  /** El cliente descarga un archivo del chat (los suyos o los que le mandó el equipo). */
  @Get("files/:messageId/:index")
  file(@Param("messageId") messageId: string, @Param("index", ParseIntPipe) index: number, @CurrentCustomer() customer: AuthCustomer) {
    return this.files.customerFile(customer.id, messageId, index);
  }

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
