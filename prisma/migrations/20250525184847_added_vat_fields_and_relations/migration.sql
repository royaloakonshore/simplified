/*
  Warnings:

  - A unique constraint covering the columns `[companyId]` on the table `Settings` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Company_name_key";

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultVatRatePercent" DECIMAL(5,2),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "vatId" TEXT;

-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "defaultVatRatePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."Settings" ADD COLUMN     "companyId" TEXT;

-- DropEnum
DROP TYPE "public"."InventoryMaterialType";

-- DropEnum
DROP TYPE "public"."MaterialType";

-- CreateIndex
CREATE UNIQUE INDEX "Settings_companyId_key" ON "public"."Settings"("companyId");

-- AddForeignKey
ALTER TABLE "public"."Settings" ADD CONSTRAINT "Settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
