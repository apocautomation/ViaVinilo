-- AlterEnum
ALTER TYPE "MailIngestResult" ADD VALUE 'COMMAND';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "botResetAt" TIMESTAMP(3);

