import { Module } from "@nestjs/common";
import { AppAuthController } from "./app-auth.controller";
import { ActivationService } from "./activation.service";
import { AppAuthService } from "./app-auth.service";

@Module({
  controllers: [AppAuthController],
  providers: [AppAuthService, ActivationService],
  exports: [ActivationService],
})
export class AppAuthModule {}
