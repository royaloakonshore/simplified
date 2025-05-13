/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('quotation', 'work_order');

-- CreateEnum
CREATE TYPE "public"."InventoryMaterialType" AS ENUM ('raw_material', 'manufactured');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."OrderStatus" ADD VALUE 'quote_sent';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'quote_accepted';
ALTER TYPE "public"."OrderStatus" ADD VALUE 'quote_rejected';

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "vatReverseCharge" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "totalAmount" SET DEFAULT 0.00,
ALTER COLUMN "totalVatAmount" SET DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."InvoiceItem" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orderType" "public"."OrderType" NOT NULL DEFAULT 'work_order',
ADD COLUMN     "productionStep" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "totalAmount" SET DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "public"."Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "public"."Invoice"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceId_key" ON "public"."Order"("invoiceId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "public"."Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "public"."Order"("userId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
