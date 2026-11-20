import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AppChatController, ConversationsController } from "./conversations.controller";
import { ConversationFilesService } from "./conversation-files.service";
import { ConversationsService } from "./conversations.service";

@Module({
  controllers: [ConversationsController, AppChatController],
  providers: [ConversationsService, ConversationFilesService, AuditService],
})
export class ConversationsModule {}
