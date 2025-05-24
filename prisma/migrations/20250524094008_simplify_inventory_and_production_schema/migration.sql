/*
  Warnings:

  - You are about to drop the column `rawMaterialItemId` on the `BillOfMaterialItem` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `materialType` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `InventoryItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `BillOfMaterial` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[billOfMaterialId,componentItemId]` on the table `BillOfMaterialItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `componentItemId` to the `BillOfMaterialItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `costPrice` on table `InventoryItem` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('RAW_MATERIAL', 'MANUFACTURED_GOOD');

-- DropForeignKey
ALTER TABLE "public"."BillOfMaterial" DROP CONSTRAINT "BillOfMaterial_manufacturedItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BillOfMaterialItem" DROP CONSTRAINT "BillOfMaterialItem_rawMaterialItemId_fkey";

-- DropIndex
DROP INDEX "public"."InventoryItem_category_idx";

-- DropIndex
DROP INDEX "public"."InventoryItem_name_idx";

-- AlterTable
ALTER TABLE "public"."BillOfMaterial" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "totalCalculatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "manualLaborCost" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."BillOfMaterialItem" DROP COLUMN "rawMaterialItemId",
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "componentItemId" TEXT NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."InventoryItem" DROP COLUMN "category",
DROP COLUMN "imageUrl",
DROP COLUMN "materialType",
DROP COLUMN "notes",
ADD COLUMN     "internalRemarks" TEXT,
ADD COLUMN     "inventoryCategoryId" TEXT,
ADD COLUMN     "itemType" "public"."ItemType" NOT NULL DEFAULT 'RAW_MATERIAL',
ALTER COLUMN "sku" DROP NOT NULL,
ALTER COLUMN "costPrice" SET NOT NULL,
ALTER COLUMN "costPrice" SET DEFAULT 0,
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "salesPrice" SET DEFAULT 0,
ALTER COLUMN "salesPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "quantityOnHand" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,
    "companyId" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryCategory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "public"."Company"("name");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "public"."Supplier"("companyId");

-- CreateIndex
CREATE INDEX "InventoryCategory_companyId_idx" ON "public"."InventoryCategory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_companyId_name_key" ON "public"."InventoryCategory"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterial_name_key" ON "public"."BillOfMaterial"("name");

-- CreateIndex
CREATE INDEX "BillOfMaterial_companyId_idx" ON "public"."BillOfMaterial"("companyId");

-- CreateIndex
CREATE INDEX "BillOfMaterialItem_companyId_idx" ON "public"."BillOfMaterialItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterialItem_billOfMaterialId_componentItemId_key" ON "public"."BillOfMaterialItem"("billOfMaterialId", "componentItemId");

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_idx" ON "public"."InventoryItem"("companyId");

-- CreateIndex
CREATE INDEX "InventoryItem_supplierId_idx" ON "public"."InventoryItem"("supplierId");

-- CreateIndex
CREATE INDEX "InventoryItem_inventoryCategoryId_idx" ON "public"."InventoryItem"("inventoryCategoryId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "public"."Order"("companyId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryCategoryId_fkey" FOREIGN KEY ("inventoryCategoryId") REFERENCES "public"."InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterial" ADD CONSTRAINT "BillOfMaterial_manufacturedItemId_fkey" FOREIGN KEY ("manufacturedItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterial" ADD CONSTRAINT "BillOfMaterial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterialItem" ADD CONSTRAINT "BillOfMaterialItem_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillOfMaterialItem" ADD CONSTRAINT "BillOfMaterialItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryCategory" ADD CONSTRAINT "InventoryCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
