/*
  Warnings:

  - You are about to drop the column `billingAddress` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingAddress` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `bankAccountNumber` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `bankBic` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `defaultInvoiceNotes` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `defaultPaymentTermsDays` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `finvoiceOperator` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the `InvoiceItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[originalInvoiceId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[creditNoteId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bankAccountIban` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bankSwiftBic` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postalCode` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streetAddress` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."InventoryMaterialType" AS ENUM ('raw_material', 'manufactured');

-- DropForeignKey
ALTER TABLE "public"."Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InvoiceItem" DROP CONSTRAINT "InvoiceItem_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InvoiceItem" DROP CONSTRAINT "InvoiceItem_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropIndex
DROP INDEX "public"."BillOfMaterialItem_billOfMaterialId_idx";

-- DropIndex
DROP INDEX "public"."BillOfMaterialItem_rawMaterialItemId_idx";

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "creditNoteId" TEXT,
ADD COLUMN     "isCreditNote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalInvoiceId" TEXT,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalVatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "billingAddress",
DROP COLUMN "shippingAddress",
ADD COLUMN     "productionStep" TEXT,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "createdAt",
DROP COLUMN "reference";

-- AlterTable
ALTER TABLE "public"."Settings" DROP COLUMN "bankAccountNumber",
DROP COLUMN "bankBic",
DROP COLUMN "createdAt",
DROP COLUMN "defaultInvoiceNotes",
DROP COLUMN "defaultPaymentTermsDays",
DROP COLUMN "finvoiceOperator",
DROP COLUMN "updatedAt",
ADD COLUMN     "bankAccountIban" TEXT NOT NULL,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankSwiftBic" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "finvoiceIntermediatorId" TEXT,
ADD COLUMN     "ovtId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT NOT NULL,
ADD COLUMN     "streetAddress" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."InvoiceItem";

-- DropTable
DROP TABLE "public"."OrderItem";

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2),
    "discountPercentage" DECIMAL(5,2),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "vatRatePercent" DECIMAL(5,2) NOT NULL,
    "discountAmount" DECIMAL(10,2),
    "discountPercentage" DECIMAL(5,2),

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_originalInvoiceId_key" ON "public"."Invoice"("originalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_creditNoteId_key" ON "public"."Invoice"("creditNoteId");

-- CreateIndex
CREATE INDEX "Invoice_originalInvoiceId_idx" ON "public"."Invoice"("originalInvoiceId");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "public"."Invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
