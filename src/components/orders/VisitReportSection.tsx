"use client";

import Link from "next/link";
import { Prisma } from "@prisma/client";

import { formatNordicNumber } from "@/lib/utils/nordic-numbers";

interface VisitReportLineView {
  id: string;
  item: string;
  quantity: Prisma.Decimal | number | string;
  unit: string | null;
  productNumber: string | null;
}

export interface VisitReportView {
  id: string;
  orderNumber: string | null;
  workHours: Prisma.Decimal | number | string;
  materialCostNote: string | null;
  comment: string | null;
  markedDoneAt: Date | string | null;
  lines: VisitReportLineView[];
  order?: {
    id: string;
    orderNumber: string;
    customer?: { name: string } | null;
  } | null;
}

interface VisitReportSectionProps {
  reports: VisitReportView[];
  showOrderLink?: boolean;
}

function asNumber(value: Prisma.Decimal | number | string): number {
  return new Prisma.Decimal(value).toNumber();
}

function formatWhen(value: Date | string | null): string {
  if (!value) {
    return "Done time not sent";
  }
  const when = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(when.getTime())) {
    return "Done time not sent";
  }
  return when.toLocaleString("fi-FI", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VisitReportSection({ reports, showOrderLink = false }: VisitReportSectionProps) {
  if (reports.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-lg font-medium">Visit report</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing here yet. After the crew marks the visit done in Scheduling, the hours, each line, the material note, and the comment show up here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-medium">Visit report</h3>
      {reports.map((report) => (
        <article key={report.id} className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{formatWhen(report.markedDoneAt)}</p>
              {showOrderLink && report.order ? (
                <Link href={`/orders/${report.order.id}`} className="font-medium text-primary hover:underline">
                  Order {report.order.orderNumber}
                  {report.order.customer?.name ? ` · ${report.order.customer.name}` : ""}
                </Link>
              ) : (
                <p className="font-medium">
                  {report.orderNumber ? `Order ${report.orderNumber}` : "No matching order yet"}
                </p>
              )}
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Hours </span>
              <span className="font-semibold">{formatNordicNumber(asNumber(report.workHours), 2)}</span>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium">Material cost note</h4>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {report.materialCostNote || "No material note was sent."}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium">Comment</h4>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {report.comment || "No comment was sent."}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Item</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-muted-foreground">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Unit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">Product number</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {report.lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                      No lines were sent with this report.
                    </td>
                  </tr>
                ) : (
                  report.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2 text-sm">{line.item}</td>
                      <td className="px-4 py-2 text-right text-sm">{formatNordicNumber(asNumber(line.quantity), 3)}</td>
                      <td className="px-4 py-2 text-sm">{line.unit || "—"}</td>
                      <td className="px-4 py-2 text-sm">{line.productNumber || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
