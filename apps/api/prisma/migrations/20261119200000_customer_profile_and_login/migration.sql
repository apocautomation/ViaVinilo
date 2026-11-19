-- CreateEnum
CREATE TYPE "TaxCondition" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "creditEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "fiscalAddress" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "taxCondition" "TaxCondition";

-- CreateTable
CREATE TABLE "CustomerLoginCode" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLoginCode_email_createdAt_idx" ON "CustomerLoginCode"("email", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerLoginCode_customerId_idx" ON "CustomerLoginCode"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_cuit_key" ON "Customer"("cuit");

-- AddForeignKey
ALTER TABLE "CustomerLoginCode" ADD CONSTRAINT "CustomerLoginCode_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

