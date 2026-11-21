import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AppJobsController, AppJobsService } from "./app-jobs.controller";
import { CatalogController } from "./catalog.controller";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { SectorAccess } from "./sector-access";
import { TimesController, TimesService } from "./times.controller";

@Module({
  controllers: [TimesController, JobsController, CatalogController, AppJobsController],
  providers: [JobsService, AppJobsService, TimesService, SectorAccess, AuditService],
})
export class JobsModule {}
