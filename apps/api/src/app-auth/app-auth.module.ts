import { Module } from "@nestjs/common";
import { AppAuthController } from "./app-auth.controller";
import { AppAuthService } from "./app-auth.service";

@Module({
  controllers: [AppAuthController],
  providers: [AppAuthService],
})
export class AppAuthModule {}
