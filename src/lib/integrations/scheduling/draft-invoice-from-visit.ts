import { InvoiceStatus, OrderStatus, Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateInvoiceReferenceNumber } from "@/lib/utils/finnishReferenceNumber";

type Db = PrismaClient | Prisma.TransactionClient;

export interface VisitLineForInvoice {
  item: string;
  quantity: number;
  productNumber: string | null;
}

export interface OrderLineForInvoice {
  inventoryItemId: string;
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRatePercent: number;
  costPrice: number;
  discountAmount: number | null;
  discountPercentage: number | null;
}

export interface PlannedInvoiceLine {
  inventoryItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRatePercent: number;
  discountAmount: number | null;
  discountPercentage: number | null;
  calculatedUnitCost: number;
  calculatedUnitProfit: number;
  calculatedLineProfit: number;
  source: "order" | "report-extra";
}

/**
 * Bills from the work order lines. When the visit report includes lines, matching
 * SKUs take the reported quantity. Extra report SKUs that exist in inventory become
 * added lines. Unmatched report text is returned for the invoice notes.
 */
export function planInvoiceLinesFromVisit(args: {
  orderItems: OrderLineForInvoice[];
  reportLines: VisitLineForInvoice[];
  extraInventoryBySku: Map<string, { id: string; name: string; salesPrice: number; costPrice: number; defaultVatRatePercent: number }>;
  companyDefaultVatRate: number;
}): { lines: PlannedInvoiceLine[]; unmatchedReportLines: string[] } {
  const qtyBySku = new Map<string, number>();
  const unmatchedReportLines: string[] = [];
  const usedExtraSkus = new Set<string>();

  for (const reportLine of args.reportLines) {
    const sku = reportLine.productNumber?.trim();
    if (!sku) {
      unmatchedReportLines.push(`${reportLine.item} (qty ${reportLine.quantity})`);
      continue;
    }
    qtyBySku.set(sku.toUpperCase(), reportLine.quantity);
  }

  const lines: PlannedInvoiceLine[] = args.orderItems.map((orderItem) => {
    const skuKey = orderItem.sku?.trim().toUpperCase() ?? "";
    const quantity =
      skuKey && qtyBySku.has(skuKey) ? (qtyBySku.get(skuKey) as number) : orderItem.quantity;
    if (skuKey) {
      usedExtraSkus.add(skuKey);
    }
    const unitPrice = orderItem.unitPrice;
    const calculatedUnitCost = orderItem.costPrice;
    const calculatedUnitProfit = unitPrice - calculatedUnitCost;
    return {
      inventoryItemId: orderItem.inventoryItemId,
      description: orderItem.name,
      quantity,
      unitPrice,
      vatRatePercent: orderItem.vatRatePercent,
      discountAmount: orderItem.discountAmount,
      discountPercentage: orderItem.discountPercentage,
      calculatedUnitCost,
      calculatedUnitProfit,
      calculatedLineProfit: calculatedUnitProfit * quantity,
      source: "order",
    };
  });

  for (const [skuKey, quantity] of qtyBySku) {
    if (usedExtraSkus.has(skuKey)) {
      continue;
    }
    const inventory = args.extraInventoryBySku.get(skuKey);
    if (!inventory) {
      const reportLine = args.reportLines.find(
        (line) => line.productNumber?.trim().toUpperCase() === skuKey,
      );
      unmatchedReportLines.push(
        reportLine
          ? `${reportLine.item} #${reportLine.productNumber} (qty ${reportLine.quantity})`
          : `Unknown SKU ${skuKey}`,
      );
      continue;
    }
    const unitPrice = inventory.salesPrice;
    const calculatedUnitCost = inventory.costPrice;
    const calculatedUnitProfit = unitPrice - calculatedUnitCost;
    lines.push({
      inventoryItemId: inventory.id,
      description: inventory.name,
      quantity,
      unitPrice,
      vatRatePercent: inventory.defaultVatRatePercent || args.companyDefaultVatRate,
      discountAmount: null,
      discountPercentage: null,
      calculatedUnitCost,
      calculatedUnitProfit,
      calculatedLineProfit: calculatedUnitProfit * quantity,
      source: "report-extra",
    });
  }

  return { lines, unmatchedReportLines };
}

export function buildVisitInvoiceNotes(args: {
  workHours: number;
  materialCostNote: string | null;
  comment: string | null;
  unmatchedReportLines: string[];
}): string {
  const parts: string[] = [
    `Field visit report. Work hours: ${args.workHours}.`,
  ];
  if (args.materialCostNote) {
    parts.push(`Material cost note: ${args.materialCostNote}`);
  }
  if (args.comment) {
    parts.push(`Comment: ${args.comment}`);
  }
  if (args.unmatchedReportLines.length > 0) {
    parts.push(
      `Lines not matched to stock (review before sending): ${args.unmatchedReportLines.join("; ")}`,
    );
  }
  return parts.join("\n\n");
}

export function nextInvoiceNumberFromLast(lastInvoiceNumber: string | null | undefined): string {
  if (!lastInvoiceNumber) {
    return "INV-00001";
  }
  try {
    let numericPart = parseInt(lastInvoiceNumber.replace(/\D/g, ""), 10);
    if (Number.isNaN(numericPart)) {
      numericPart = 0;
    }
    const newNumericPart = numericPart + 1;
    const prefixMatch = lastInvoiceNumber.match(/^([^0-9]*)/);
    const prefix = prefixMatch && prefixMatch[0] ? prefixMatch[0] : "INV-";
    const lastNumericString = lastInvoiceNumber.replace(/^[^0-9]*/, "");
    const paddingLength = lastNumericString.length > 0 ? lastNumericString.length : 5;
    return prefix + newNumericPart.toString().padStart(paddingLength, "0");
  } catch {
    return "INV-00001";
  }
}

export interface DraftInvoiceFromVisitResult {
  created: boolean;
  updated: boolean;
  skipped: boolean;
  reason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
}

async function loadCompanyVat(db: Db, companyId: string | null): Promise<number> {
  if (!companyId) {
    return 0;
  }
  const settings = await db.settings.findUnique({
    where: { companyId },
    select: { defaultVatRatePercent: true },
  });
  if (!settings?.defaultVatRatePercent) {
    return 0;
  }
  return new Prisma.Decimal(settings.defaultVatRatePercent.toString()).toNumber();
}

/**
 * Creates or refreshes a draft invoice for a stored visit report.
 * Soft-fail callers should catch errors; this throws only on unexpected DB failures.
 */
export async function draftInvoiceFromVisitReport(
  visitReportId: string,
  db: Db = prisma,
): Promise<DraftInvoiceFromVisitResult> {
  const report = await db.visitReport.findUnique({
    where: { id: visitReportId },
    include: {
      lines: { orderBy: { position: "asc" } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
      order: {
        include: {
          customer: { select: { id: true, defaultPaymentTermsDays: true } },
          items: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  salesPrice: true,
                  costPrice: true,
                  defaultVatRatePercent: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!report) {
    return { created: false, updated: false, skipped: true, reason: "Visit report was not found." };
  }
  if (!report.order) {
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "No matching order yet.",
    };
  }
  if (!report.order.customer) {
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "Order customer is missing.",
    };
  }
  if (report.order.items.length === 0 && report.lines.length === 0) {
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "Order has no lines to bill.",
    };
  }

  if (report.invoice && report.invoice.status !== InvoiceStatus.draft) {
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "Linked invoice is no longer a draft.",
      invoiceId: report.invoice.id,
      invoiceNumber: report.invoice.invoiceNumber,
    };
  }

  const companyDefaultVatRate = await loadCompanyVat(db, report.companyId ?? report.order.companyId);

  const orderItems: OrderLineForInvoice[] = report.order.items.map((item) => {
    const inventory = item.inventoryItem;
    const unitPrice = item.unitPrice
      ? new Prisma.Decimal(item.unitPrice.toString()).toNumber()
      : inventory.salesPrice
        ? new Prisma.Decimal(inventory.salesPrice.toString()).toNumber()
        : 0;
    const vatRate =
      item.vatRatePercent !== null && item.vatRatePercent !== undefined
        ? new Prisma.Decimal(item.vatRatePercent.toString()).toNumber()
        : inventory.defaultVatRatePercent !== null && inventory.defaultVatRatePercent !== undefined
          ? new Prisma.Decimal(inventory.defaultVatRatePercent.toString()).toNumber()
          : companyDefaultVatRate;
    return {
      inventoryItemId: inventory.id,
      sku: inventory.sku,
      name: inventory.name,
      quantity: new Prisma.Decimal(item.quantity.toString()).toNumber(),
      unitPrice,
      vatRatePercent: vatRate,
      costPrice: inventory.costPrice
        ? new Prisma.Decimal(inventory.costPrice.toString()).toNumber()
        : 0,
      discountAmount: item.discountAmount
        ? new Prisma.Decimal(item.discountAmount.toString()).toNumber()
        : null,
      discountPercentage: item.discountPercentage
        ? new Prisma.Decimal(item.discountPercentage.toString()).toNumber()
        : null,
    };
  });

  const reportLines: VisitLineForInvoice[] = report.lines.map((line) => ({
    item: line.item,
    quantity: new Prisma.Decimal(line.quantity.toString()).toNumber(),
    productNumber: line.productNumber,
  }));

  const orderSkuKeys = new Set(
    orderItems
      .map((item) => item.sku?.trim().toUpperCase())
      .filter((sku): sku is string => Boolean(sku)),
  );
  const extraSkus = [
    ...new Set(
      reportLines
        .map((line) => line.productNumber?.trim().toUpperCase())
        .filter((sku): sku is string => Boolean(sku) && !orderSkuKeys.has(sku as string)),
    ),
  ];

  const extraInventoryBySku = new Map<
    string,
    { id: string; name: string; salesPrice: number; costPrice: number; defaultVatRatePercent: number }
  >();
  if (extraSkus.length > 0) {
    const inventoryRows = await db.inventoryItem.findMany({
      where: {
        OR: extraSkus.map((sku) => ({
          sku: { equals: sku, mode: "insensitive" as const },
        })),
        ...(report.companyId ? { companyId: report.companyId } : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        salesPrice: true,
        costPrice: true,
        defaultVatRatePercent: true,
      },
    });
    for (const row of inventoryRows) {
      if (!row.sku) {
        continue;
      }
      extraInventoryBySku.set(row.sku.trim().toUpperCase(), {
        id: row.id,
        name: row.name,
        salesPrice: row.salesPrice ? new Prisma.Decimal(row.salesPrice.toString()).toNumber() : 0,
        costPrice: row.costPrice ? new Prisma.Decimal(row.costPrice.toString()).toNumber() : 0,
        defaultVatRatePercent: row.defaultVatRatePercent
          ? new Prisma.Decimal(row.defaultVatRatePercent.toString()).toNumber()
          : companyDefaultVatRate,
      });
    }
  }

  const planned = planInvoiceLinesFromVisit({
    orderItems,
    reportLines,
    extraInventoryBySku,
    companyDefaultVatRate,
  });

  if (planned.lines.length === 0) {
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "No billable lines could be matched to stock.",
    };
  }

  let subTotal = new Prisma.Decimal(0);
  let totalVatAmountValue = new Prisma.Decimal(0);
  const invoiceItemsToCreate = planned.lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const lineTotal = unitPrice.times(quantity);
    subTotal = subTotal.plus(lineTotal);
    const vatRate = new Prisma.Decimal(line.vatRatePercent);
    const itemVat = lineTotal.times(vatRate.div(100));
    totalVatAmountValue = totalVatAmountValue.plus(itemVat);
    return {
      inventoryItemId: line.inventoryItemId,
      description: line.description,
      quantity,
      unitPrice,
      vatRatePercent: vatRate,
      discountAmount:
        line.discountAmount !== null ? new Prisma.Decimal(line.discountAmount) : null,
      discountPercentage:
        line.discountPercentage !== null ? new Prisma.Decimal(line.discountPercentage) : null,
      calculatedUnitCost: new Prisma.Decimal(line.calculatedUnitCost),
      calculatedUnitProfit: new Prisma.Decimal(line.calculatedUnitProfit),
      calculatedLineProfit: new Prisma.Decimal(line.calculatedLineProfit),
    };
  });

  const notes = buildVisitInvoiceNotes({
    workHours: new Prisma.Decimal(report.workHours.toString()).toNumber(),
    materialCostNote: report.materialCostNote,
    comment: report.comment,
    unmatchedReportLines: planned.unmatchedReportLines,
  });

  const paymentDays = report.order.customer.defaultPaymentTermsDays ?? 14;
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + paymentDays * 24 * 60 * 60 * 1000);
  const orderId = report.order.id;
  const customerId = report.order.customer.id;
  const userId = report.order.userId;
  const companyId = report.companyId ?? report.order.companyId;

  if (report.invoiceId && report.invoice) {
    await db.invoiceItem.deleteMany({ where: { invoiceId: report.invoiceId } });
    await db.invoice.update({
      where: { id: report.invoiceId },
      data: {
        notes,
        invoiceDate,
        dueDate,
        totalAmount: subTotal,
        totalVatAmount: totalVatAmountValue,
        status: InvoiceStatus.draft,
        items: { create: invoiceItemsToCreate },
      },
    });
    await db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.invoiced },
    });
    return {
      created: false,
      updated: true,
      skipped: false,
      invoiceId: report.invoice.id,
      invoiceNumber: report.invoice.invoiceNumber,
    };
  }

  const lastInvoice = await db.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });
  const nextInvoiceNumber = nextInvoiceNumberFromLast(lastInvoice?.invoiceNumber);
  let referenceNumber: string | undefined;
  try {
    referenceNumber = generateInvoiceReferenceNumber(nextInvoiceNumber);
  } catch {
    referenceNumber = undefined;
  }

  const created = await db.invoice.create({
    data: {
      customer: { connect: { id: customerId } },
      invoiceNumber: nextInvoiceNumber,
      referenceNumber,
      invoiceDate,
      dueDate,
      status: InvoiceStatus.draft,
      notes,
      vatReverseCharge: false,
      totalAmount: subTotal,
      totalVatAmount: totalVatAmountValue,
      ourReference: report.order.ourReference,
      customerNumber: report.order.customerNumber,
      user: { connect: { id: userId } },
      ...(companyId ? { Company: { connect: { id: companyId } } } : {}),
      order: { connect: { id: orderId } },
      items: { create: invoiceItemsToCreate },
    },
    select: { id: true, invoiceNumber: true },
  });

  await db.visitReport.update({
    where: { id: report.id },
    data: { invoiceId: created.id },
  });
  await db.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.invoiced },
  });

  return {
    created: true,
    updated: false,
    skipped: false,
    invoiceId: created.id,
    invoiceNumber: created.invoiceNumber,
  };
}
