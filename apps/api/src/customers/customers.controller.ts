import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import {
  addEmailSchema,
  addPhoneSchema,
  blockCustomerSchema,
  createCustomerSchema,
  listCustomersSchema,
  setAppPasswordSchema,
  updateCustomerSchema,
} from "@viavinilo/contracts";
import { CurrentUser, Roles, type AuthUser } from "../auth/decorators";
import { ZodBody, ZodQuery } from "../common/zod";
import { CustomersService } from "./customers.service";

/**
 * Clientes del gremio. Todo el personal puede consultar; atención (asesores) y el dueño
 * cargan, editan y validan altas; solo el dueño da de baja (D-017).
 */
@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@ZodQuery(listCustomersSchema) query: Parameters<CustomersService["list"]>[0]) {
    return this.customers.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.customers.get(id);
  }

  @Post()
  @Roles("ATTENTION")
  create(
    @ZodBody(createCustomerSchema) body: Parameters<CustomersService["create"]>[0],
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.create(body, user.id);
  }

  @Patch(":id")
  @Roles("ATTENTION")
  update(
    @Param("id") id: string,
    @ZodBody(updateCustomerSchema) body: Parameters<CustomersService["update"]>[1],
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.update(id, body, user.id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @Roles("ATTENTION")
  approve(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.customers.approve(id, user.id);
  }

  @Post(":id/block")
  @HttpCode(200)
  @Roles("ATTENTION")
  block(
    @Param("id") id: string,
    @ZodBody(blockCustomerSchema) body: { reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.block(id, body.reason, user.id);
  }

  /** Pone o cambia la contraseña de la app del cliente (D-039). */
  @Post(":id/app-password")
  @HttpCode(200)
  @Roles("ATTENTION")
  setAppPassword(
    @Param("id") id: string,
    @ZodBody(setAppPasswordSchema) body: { password: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.setAppPassword(id, body.password, user.id);
  }

  @Post(":id/unblock")
  @HttpCode(200)
  @Roles("ATTENTION")
  unblock(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.customers.unblock(id, user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles("OWNER")
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.customers.remove(id, user.id);
  }

  @Post(":id/emails")
  @Roles("ATTENTION")
  addEmail(
    @Param("id") id: string,
    @ZodBody(addEmailSchema) body: { email: string; isPrimary?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.addEmail(id, body.email, body.isPrimary, user.id);
  }

  @Delete(":id/emails/:emailId")
  @Roles("ATTENTION")
  removeEmail(@Param("id") id: string, @Param("emailId") emailId: string, @CurrentUser() user: AuthUser) {
    return this.customers.removeEmail(id, emailId, user.id);
  }

  @Post(":id/phones")
  @Roles("ATTENTION")
  addPhone(
    @Param("id") id: string,
    @ZodBody(addPhoneSchema) body: { phone: string; isPrimary?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.addPhone(id, body.phone, body.isPrimary, user.id);
  }

  @Delete(":id/phones/:phoneId")
  @Roles("ATTENTION")
  removePhone(@Param("id") id: string, @Param("phoneId") phoneId: string, @CurrentUser() user: AuthUser) {
    return this.customers.removePhone(id, phoneId, user.id);
  }
}
