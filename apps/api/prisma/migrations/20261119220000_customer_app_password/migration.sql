-- DropForeignKey
ALTER TABLE "CustomerLoginCode" DROP CONSTRAINT "CustomerLoginCode_customerId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "appPasswordHash" TEXT,
ADD COLUMN     "appPasswordSetAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "CustomerLoginCode";

