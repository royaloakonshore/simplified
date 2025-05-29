-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "defaultVatRatePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."Settings" ADD COLUMN     "defaultVatRatePercent" DECIMAL(5,2);
