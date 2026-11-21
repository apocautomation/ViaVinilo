import { Controller, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import {
  alertSettingsSchema,
  createUserSchema,
  errorReasonSchema,
  machineSchema,
  setStaffPasswordSchema,
  updateErrorReasonSchema,
  updateMachineSchema,
  updateUserSchema,
  type AlertSettings,
} from "@viavinilo/contracts";
import { CurrentUser, Roles, type AuthUser } from "../auth/decorators";
import { ZodBody } from "../common/zod";
import { AdminService } from "./admin.service";

/** Configuración del ERP (D-067). Solo el dueño. */
@Controller("admin")
@Roles("OWNER")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("users")
  users() {
    return this.admin.users();
  }

  @Post("users")
  createUser(
    @ZodBody(createUserSchema) body: { name: string; email: string; roles: UserRole[]; sectorIds: string[]; password: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.createUser(body, user.id);
  }

  @Patch("users/:id")
  updateUser(
    @Param("id") id: string,
    @ZodBody(updateUserSchema) body: { name?: string; email?: string; roles?: UserRole[]; sectorIds?: string[]; active?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateUser(id, body, user.id);
  }

  @Post("users/:id/password")
  @HttpCode(200)
  setPassword(@Param("id") id: string, @ZodBody(setStaffPasswordSchema) body: { password: string }, @CurrentUser() user: AuthUser) {
    return this.admin.setPassword(id, body.password, user.id);
  }

  @Get("machines")
  machines() {
    return this.admin.machines();
  }

  @Post("machines")
  createMachine(@ZodBody(machineSchema) body: { name: string; sectorIds: string[] }, @CurrentUser() user: AuthUser) {
    return this.admin.createMachine(body, user.id);
  }

  @Patch("machines/:id")
  updateMachine(
    @Param("id") id: string,
    @ZodBody(updateMachineSchema) body: { name?: string; sectorIds?: string[]; active?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.updateMachine(id, body, user.id);
  }

  @Get("error-reasons")
  errorReasons() {
    return this.admin.errorReasons();
  }

  @Post("error-reasons")
  createErrorReason(@ZodBody(errorReasonSchema) body: { label: string }, @CurrentUser() user: AuthUser) {
    return this.admin.createErrorReason(body.label, user.id);
  }

  @Patch("error-reasons/:id")
  updateErrorReason(@Param("id") id: string, @ZodBody(updateErrorReasonSchema) body: { label?: string; active?: boolean }, @CurrentUser() user: AuthUser) {
    return this.admin.updateErrorReason(id, body, user.id);
  }

  @Get("alerts")
  alerts() {
    return this.admin.alertSettings();
  }

  @Put("alerts")
  setAlerts(@ZodBody(alertSettingsSchema) body: AlertSettings, @CurrentUser() user: AuthUser) {
    return this.admin.setAlertSettings(body, user.id);
  }
}
