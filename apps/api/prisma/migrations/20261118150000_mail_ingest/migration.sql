-- CreateEnum
CREATE TYPE "MailIngestResult" AS ENUM ('CREATED', 'PENDING_SIGNUP', 'DUPLICATE', 'SKIPPED_NO_FILES', 'SKIPPED_AUTO_REPLY', 'REJECTED_BLOCKED', 'ERROR');

-- DropIndex
DROP INDEX "JobOrder_sourceMessageId_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "signupInviteSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MailIngestLog" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT,
    "subject" TEXT,
    "sentAt" TIMESTAMP(3),
    "result" "MailIngestResult" NOT NULL,
    "jobId" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailIngestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxState" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "uidValidity" BIGINT,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailIngestLog_sectorId_createdAt_idx" ON "MailIngestLog"("sectorId", "createdAt");

-- CreateIndex
CREATE INDEX "MailIngestLog_messageId_idx" ON "MailIngestLog"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxState_sectorId_key" ON "MailboxState"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOrder_sectorId_sourceMessageId_key" ON "JobOrder"("sectorId", "sourceMessageId");

-- AddForeignKey
ALTER TABLE "MailIngestLog" ADD CONSTRAINT "MailIngestLog_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxState" ADD CONSTRAINT "MailboxState_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

