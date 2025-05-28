/*
  Warnings:

  - You are about to drop the column `address` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `defaultVatRatePercent` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `vatId` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `defaultVatRatePercent` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `Settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Settings" DROP CONSTRAINT "Settings_companyId_fkey";

-- DropIndex
DROP INDEX "public"."Settings_companyId_key";

-- AlterTable
ALTER TABLE "public"."Company" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "defaultVatRatePercent",
DROP COLUMN "email",
DROP COLUMN "phone",
DROP COLUMN "postalCode",
DROP COLUMN "vatId";

-- AlterTable
ALTER TABLE "public"."InventoryItem" DROP COLUMN "defaultVatRatePercent";

-- AlterTable
ALTER TABLE "public"."Settings" DROP COLUMN "companyId",
ADD COLUMN     "defaultInvoicePaymentTermsDays" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "public"."Company"("name");
