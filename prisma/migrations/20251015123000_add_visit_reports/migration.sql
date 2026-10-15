-- CreateTable
CREATE TABLE "public"."VisitReport" (
    "id" TEXT NOT NULL,
    "externalVisitId" TEXT NOT NULL,
    "companyId" TEXT,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "workHours" DECIMAL(8,2) NOT NULL,
    "materialCostNote" TEXT,
    "comment" TEXT,
    "markedDoneAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VisitReportLine" (
    "id" TEXT NOT NULL,
    "visitReportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT,
    "productNumber" TEXT,

    CONSTRAINT "VisitReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitReport_externalVisitId_key" ON "public"."VisitReport"("externalVisitId");

-- CreateIndex
CREATE INDEX "VisitReport_companyId_idx" ON "public"."VisitReport"("companyId");

-- CreateIndex
CREATE INDEX "VisitReport_orderId_idx" ON "public"."VisitReport"("orderId");

-- CreateIndex
CREATE INDEX "VisitReport_orderNumber_idx" ON "public"."VisitReport"("orderNumber");

-- CreateIndex
CREATE INDEX "VisitReportLine_visitReportId_idx" ON "public"."VisitReportLine"("visitReportId");

-- AddForeignKey
ALTER TABLE "public"."VisitReport" ADD CONSTRAINT "VisitReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VisitReport" ADD CONSTRAINT "VisitReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VisitReportLine" ADD CONSTRAINT "VisitReportLine_visitReportId_fkey" FOREIGN KEY ("visitReportId") REFERENCES "public"."VisitReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
