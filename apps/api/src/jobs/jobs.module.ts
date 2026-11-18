import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { CatalogController } from "./catalog.controller";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { SectorAccess } from "./sector-access";

@Module({
  controllers: [JobsController, CatalogController],
  providers: [JobsService, SectorAccess, AuditService],
})
export class JobsModule {}
