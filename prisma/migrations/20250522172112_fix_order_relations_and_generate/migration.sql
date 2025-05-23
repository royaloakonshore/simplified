/*
  Warnings:

  - A unique constraint covering the columns `[qrIdentifier]` on the table `InventoryItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrIdentifier]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Order_userId_idx";

-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "qrIdentifier" TEXT,
ADD COLUMN     "quantityOnHand" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "showInPricelist" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supplierId" TEXT,
ALTER COLUMN "unitOfMeasure" DROP NOT NULL,
ALTER COLUMN "costPrice" DROP NOT NULL,
ALTER COLUMN "reorderLevel" DROP NOT NULL,
ALTER COLUMN "reorderLevel" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "qrIdentifier" TEXT,
ALTER COLUMN "totalAmount" DROP NOT NULL,
ALTER COLUMN "totalAmount" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_qrIdentifier_key" ON "public"."InventoryItem"("qrIdentifier");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "public"."InventoryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "public"."InventoryItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Order_qrIdentifier_key" ON "public"."Order"("qrIdentifier");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderType_idx" ON "public"."Order"("orderType");
