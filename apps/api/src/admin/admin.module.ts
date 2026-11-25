import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { StaffActivationService } from "../auth/staff-activation.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({ controllers: [AdminController, NotificationsController], providers: [AdminService, NotificationsService, AuditService, StaffActivationService], exports: [AdminService] })
export class AdminModule {}
