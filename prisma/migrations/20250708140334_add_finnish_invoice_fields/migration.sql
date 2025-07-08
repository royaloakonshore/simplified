/*
  Warnings:

  - The values [ready_to_invoice] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[customerNumber]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OrderStatus_new" AS ENUM ('draft', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled', 'invoiced');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Order" ALTER COLUMN "status" TYPE "public"."OrderStatus_new" USING ("status"::text::"public"."OrderStatus_new");
ALTER TYPE "public"."OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "public"."OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "public"."Order" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_originalInvoiceId_fkey";

-- DropIndex
DROP INDEX "public"."Invoice_referenceNumber_key";

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "customerNumber" TEXT;

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "complaintPeriod" TEXT,
ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "orderNumber" TEXT,
ADD COLUMN     "ourReference" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER,
ADD COLUMN     "penaltyInterest" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "ourReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNumber_key" ON "public"."Customer"("customerNumber");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
