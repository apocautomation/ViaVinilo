import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AppChatController, ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  controllers: [ConversationsController, AppChatController],
  providers: [ConversationsService, AuditService],
})
export class ConversationsModule {}
