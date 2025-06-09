-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "public"."Customer"("companyId");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "public"."Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "public"."Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_vatId_idx" ON "public"."Customer"("vatId");

-- CreateIndex
CREATE INDEX "InventoryItem_itemType_idx" ON "public"."InventoryItem"("itemType");

-- CreateIndex
CREATE INDEX "InventoryItem_showInPricelist_idx" ON "public"."InventoryItem"("showInPricelist");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "public"."InventoryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_sku_idx" ON "public"."InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryItem_quantityOnHand_idx" ON "public"."InventoryItem"("quantityOnHand");

-- CreateIndex
CREATE INDEX "InventoryItem_reorderLevel_idx" ON "public"."InventoryItem"("reorderLevel");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "public"."Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "public"."Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "public"."Invoice"("dueDate");
