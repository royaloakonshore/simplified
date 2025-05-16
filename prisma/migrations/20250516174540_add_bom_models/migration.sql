/*
  Warnings:

  - You are about to drop the column `creditNoteId` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `originalInvoiceId` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `totalVatAmount` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `discountPercent` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `itemId` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `vatRatePercent` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productionStep` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discountPercent` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `itemId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `bankAccountIban` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `bankSwiftBic` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `finvoiceIntermediatorId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `ovtId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `streetAddress` on the `Settings` table. All the data in the column will be lost.
  - Added the required column `inventoryItemId` to the `InvoiceItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `InvoiceItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `discountAmount` on table `InvoiceItem` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `inventoryItemId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `discountAmount` on table `OrderItem` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_originalInvoiceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InvoiceItem" DROP CONSTRAINT "InvoiceItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_itemId_fkey";

-- DropIndex
DROP INDEX "public"."Invoice_creditNoteId_key";

-- DropIndex
DROP INDEX "public"."Invoice_orderId_key";

-- DropIndex
DROP INDEX "public"."Invoice_originalInvoiceId_key";

-- DropIndex
DROP INDEX "public"."Order_invoiceId_key";

-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "creditNoteId",
DROP COLUMN "originalInvoiceId",
DROP COLUMN "totalAmount",
DROP COLUMN "totalVatAmount";

-- AlterTable
ALTER TABLE "public"."InvoiceItem" DROP COLUMN "discountPercent",
DROP COLUMN "itemId",
DROP COLUMN "vatRatePercent",
ADD COLUMN     "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "inventoryItemId" TEXT NOT NULL,
ADD COLUMN     "vatRate" DECIMAL(4,2) NOT NULL DEFAULT 0.24,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "discountAmount" SET NOT NULL,
ALTER COLUMN "discountAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "invoiceId",
DROP COLUMN "productionStep",
DROP COLUMN "totalAmount",
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "shippingAddress" TEXT;

-- AlterTable
ALTER TABLE "public"."OrderItem" DROP COLUMN "discountPercent",
DROP COLUMN "itemId",
ADD COLUMN     "discountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "inventoryItemId" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "discountAmount" SET NOT NULL,
ALTER COLUMN "discountAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Payment" ALTER COLUMN "paymentDate" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."Settings" DROP COLUMN "bankAccountIban",
DROP COLUMN "bankName",
DROP COLUMN "bankSwiftBic",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "email",
DROP COLUMN "finvoiceIntermediatorId",
DROP COLUMN "ovtId",
DROP COLUMN "phone",
DROP COLUMN "postalCode",
DROP COLUMN "streetAddress",
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBic" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultInvoiceNotes" TEXT,
ADD COLUMN     "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "finvoiceOperator" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "public"."InventoryMaterialType";

-- CreateTable
CREATE TABLE "public"."BillOfMaterial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturedItemId" TEXT NOT NULL,
    "manualLaborCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillOfMaterialItem" (
    "id" TEXT NOT NULL,
    "billOfMaterialId" TEXT NOT NULL,
    "rawMaterialItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterial_manufacturedItemId_key" ON "public"."BillOfMaterial"("manufacturedItemId");

-- CreateIndex
CREATE INDEX "BillOfMaterialItem_billOfMaterialId_idx" ON "public"."BillOfMaterialItem"("billOfMaterialId");

-- CreateIndex
CREATE INDEX "BillOfMaterialItem_rawMaterialItemId_idx" ON "public"."BillOfMaterialItem"("rawMaterialItemId");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "public"."Invoice"("orderId");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterial" ADD CONSTRAINT "BillOfMaterial_manufacturedItemId_fkey" FOREIGN KEY ("manufacturedItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterialItem" ADD CONSTRAINT "BillOfMaterialItem_billOfMaterialId_fkey" FOREIGN KEY ("billOfMaterialId") REFERENCES "public"."BillOfMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterialItem" ADD CONSTRAINT "BillOfMaterialItem_rawMaterialItemId_fkey" FOREIGN KEY ("rawMaterialItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
