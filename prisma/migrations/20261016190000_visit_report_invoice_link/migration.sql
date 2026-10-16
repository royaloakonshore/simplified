-- AlterTable
ALTER TABLE "public"."VisitReport" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "VisitReport_invoiceId_idx" ON "public"."VisitReport"("invoiceId");

-- AddForeignKey
ALTER TABLE "public"."VisitReport" ADD CONSTRAINT "VisitReport_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
