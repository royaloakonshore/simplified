import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  draftInvoiceFromVisitReport,
  type DraftInvoiceFromVisitResult,
} from "./draft-invoice-from-visit";
import { parseVisitDonePayload, type ParsedVisitReport } from "./parse-visit-done";

type VisitReportDb = PrismaClient | Prisma.TransactionClient;

export interface StoredVisitReport {
  created: boolean;
  linkedToOrder: boolean;
  id: string;
  externalVisitId: string;
  orderNumber: string | null;
  workHours: Prisma.Decimal;
  lineCount: number;
  hasMaterialCostNote: boolean;
  hasComment: boolean;
  draftInvoice: DraftInvoiceFromVisitResult | null;
}

async function saveReport(
  db: VisitReportDb,
  externalVisitId: string,
  existingId: string | undefined,
  shared: {
    orderId: string | null;
    orderNumber: string | null;
    companyId: string | null;
    workHours: Prisma.Decimal;
    materialCostNote: string | null;
    comment: string | null;
    markedDoneAt: Date | null;
  },
  lines: ReturnType<typeof lineRows> | null,
): Promise<{ id: string; created: boolean }> {
  if (existingId) {
    const updated = await db.visitReport.update({
      where: { id: existingId },
      data: {
        ...shared,
        ...(lines
          ? {
              lines: {
                deleteMany: {},
                create: lines,
              },
            }
          : {}),
      },
      select: { id: true },
    });
    return { id: updated.id, created: false };
  }

  try {
    const created = await db.visitReport.create({
      data: {
        externalVisitId,
        ...shared,
        ...(lines ? { lines: { create: lines } } : {}),
      },
      select: { id: true },
    });
    return { id: created.id, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await db.visitReport.findUnique({
        where: { externalVisitId },
        select: { id: true },
      });
      if (raced) {
        return saveReport(db, externalVisitId, raced.id, shared, lines);
      }
    }
    throw error;
  }
}

function lineRows(report: ParsedVisitReport) {
  if (!report.lines) {
    return null;
  }
  return report.lines.map((line) => ({
    position: line.position,
    item: line.item,
    quantity: new Prisma.Decimal(line.quantity),
    unit: line.unit,
    productNumber: line.productNumber,
  }));
}

async function tryDraftInvoice(visitReportId: string, db: VisitReportDb): Promise<DraftInvoiceFromVisitResult | null> {
  try {
    return await draftInvoiceFromVisitReport(visitReportId, db);
  } catch (error) {
    console.error(
      "Draft invoice from visit report failed",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      created: false,
      updated: false,
      skipped: true,
      reason: "Draft invoice could not be written.",
    };
  }
}

export async function storeVisitDoneReport(
  raw: unknown,
  db: VisitReportDb = prisma,
): Promise<StoredVisitReport> {
  const report = parseVisitDonePayload(raw);
  const order = report.orderNumber
    ? await db.order.findUnique({
        where: { orderNumber: report.orderNumber },
        select: { id: true, companyId: true, orderNumber: true },
      })
    : null;

  const shared = {
    orderId: order?.id ?? null,
    orderNumber: order?.orderNumber ?? report.orderNumber,
    companyId: order?.companyId ?? null,
    workHours: new Prisma.Decimal(report.workHours),
    materialCostNote: report.materialCostNote,
    comment: report.comment,
    markedDoneAt: report.markedDoneAt,
  };
  const lines = lineRows(report);

  const existing = await db.visitReport.findUnique({
    where: { externalVisitId: report.externalVisitId },
    select: { id: true },
  });

  const saved = await saveReport(db, report.externalVisitId, existing?.id, shared, lines);

  const storedLines = await db.visitReportLine.count({
    where: { visitReportId: saved.id },
  });

  const draftInvoice = order ? await tryDraftInvoice(saved.id, db) : null;

  return {
    created: saved.created,
    linkedToOrder: Boolean(order),
    id: saved.id,
    externalVisitId: report.externalVisitId,
    orderNumber: shared.orderNumber,
    workHours: shared.workHours,
    lineCount: storedLines,
    hasMaterialCostNote: Boolean(report.materialCostNote),
    hasComment: Boolean(report.comment),
    draftInvoice,
  };
}
