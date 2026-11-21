-- AlterEnum
ALTER TYPE "MailIngestResult" ADD VALUE 'RESENT';

-- AlterTable
ALTER TABLE "JobOrder" ADD COLUMN     "fileCheck" JSONB;

