-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Customer_searchText_idx" ON "Customer"("searchText");

