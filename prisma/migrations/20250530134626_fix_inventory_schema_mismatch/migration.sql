-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "vendorItemName" TEXT,
ADD COLUMN     "vendorSku" TEXT;
