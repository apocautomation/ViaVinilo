import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/decorators";
import { NotificationsService } from "./notifications.service";

/** Avisos de la campanita (D-067): cualquier usuario del ERP ve los suyos. */
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.forUser(user);
  }
}
