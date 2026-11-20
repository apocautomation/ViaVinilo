import { Module } from "@nestjs/common";
import { AppChatController, ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  controllers: [ConversationsController, AppChatController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
