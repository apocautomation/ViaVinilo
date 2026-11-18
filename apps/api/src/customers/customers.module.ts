import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, AuditService],
  exports: [CustomersService],
})
export class CustomersModule {}
