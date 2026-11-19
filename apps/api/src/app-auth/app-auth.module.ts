import { Module } from "@nestjs/common";
import { MailerService } from "../mail/mailer.service";
import { AppAuthController } from "./app-auth.controller";
import { AppAuthService } from "./app-auth.service";

@Module({
  controllers: [AppAuthController],
  providers: [AppAuthService, MailerService],
})
export class AppAuthModule {}
