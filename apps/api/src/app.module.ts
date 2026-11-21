import { Module } from "@nestjs/common";
import { AppAuthModule } from "./app-auth/app-auth.module";
import { AuthModule } from "./auth/auth.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { CustomersModule } from "./customers/customers.module";
import { HealthController } from "./health/health.controller";
import { JobsModule } from "./jobs/jobs.module";
import { AdminModule } from "./admin/admin.module";
import { StorageModule } from "./files/storage.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, AdminModule, AppAuthModule, CustomersModule, ConversationsModule, JobsModule],
  controllers: [HealthController],
})
export class AppModule {}
