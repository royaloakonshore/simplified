-- AlterTable
ALTER TABLE "public"."invoice_items" ADD COLUMN     "calculatedLineProfit" DECIMAL(10,2),
ADD COLUMN     "calculatedUnitCost" DECIMAL(10,2),
ADD COLUMN     "calculatedUnitProfit" DECIMAL(10,2);
