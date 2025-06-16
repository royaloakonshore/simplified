/*
  Warnings:

  - The values [quote_sent,quote_accepted,quote_rejected,INVOICED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

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

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "originalQuotationId" TEXT;

-- AlterTable
ALTER TABLE "public"."order_items" ADD COLUMN     "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 25.5;

-- CreateIndex
CREATE INDEX "Order_originalQuotationId_idx" ON "public"."Order"("originalQuotationId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_originalQuotationId_fkey" FOREIGN KEY ("originalQuotationId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
