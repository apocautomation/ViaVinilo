import { Module } from "@nestjs/common";
import { AppAuthController } from "./app-auth.controller";
import { ActivationService } from "./activation.service";
import { AppAuthService } from "./app-auth.service";
import { PushController } from "./push.controller";

@Module({
  controllers: [AppAuthController, PushController],
  providers: [AppAuthService, ActivationService],
  exports: [ActivationService],
})
export class AppAuthModule {}
