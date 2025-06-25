-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "weight" DECIMAL(10,2);
