-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('PENDING', 'ANSWERING', 'ANSWERED', 'HANDOFF', 'SKIPPED', 'ERROR');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "botEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsHuman" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsHumanReason" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "botStatus" "BotStatus",
ADD COLUMN     "fromBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Message_botStatus_idx" ON "Message"("botStatus");

