import { Module } from "@nestjs/common";
import { AppAuthModule } from "../app-auth/app-auth.module";
import { AuditService } from "../audit/audit.service";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [AppAuthModule],
  controllers: [CustomersController],
  providers: [CustomersService, AuditService],
  exports: [CustomersService],
})
export class CustomersModule {}
