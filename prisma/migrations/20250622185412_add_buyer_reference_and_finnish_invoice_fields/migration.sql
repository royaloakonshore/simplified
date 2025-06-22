/*
  Warnings:

  - A unique constraint covering the columns `[referenceNumber]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "buyerReference" TEXT,
ALTER COLUMN "language" SET DEFAULT 'FI';

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "sellerReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_referenceNumber_key" ON "public"."Invoice"("referenceNumber");

-- CreateIndex
CREATE INDEX "Invoice_referenceNumber_idx" ON "public"."Invoice"("referenceNumber");
