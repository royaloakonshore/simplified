/*
  Warnings:

  - A unique constraint covering the columns `[originalInvoiceId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[creditNoteId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."InvoiceStatus" ADD VALUE 'credited';

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "creditNoteId" TEXT,
ADD COLUMN     "originalInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_originalInvoiceId_key" ON "public"."Invoice"("originalInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_creditNoteId_key" ON "public"."Invoice"("creditNoteId");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "public"."Invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
