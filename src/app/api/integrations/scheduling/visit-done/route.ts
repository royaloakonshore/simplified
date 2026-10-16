import { NextResponse } from "next/server";

import {
  bearerToken,
  schedulingIntakeSecret,
  schedulingSecretMatches,
} from "@/lib/integrations/scheduling/intake-auth";
import { VisitReportParseError } from "@/lib/integrations/scheduling/parse-visit-done";
import { storeVisitDoneReport } from "@/lib/integrations/scheduling/store-visit-report";

export async function POST(request: Request) {
  const secret = schedulingIntakeSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Visit report intake is not configured." },
      { status: 503 },
    );
  }

  const provided = bearerToken(request.headers.get("authorization"));
  if (!schedulingSecretMatches(provided, secret)) {
    return NextResponse.json(
      { error: "Scheduling was not recognized." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The visit report was not valid JSON." },
      { status: 400 },
    );
  }

  try {
    const stored = await storeVisitDoneReport(body);
    return NextResponse.json(
      {
        ok: true,
        created: stored.created,
        visitReportId: stored.id,
        visitId: stored.externalVisitId,
        linkedToOrder: stored.linkedToOrder,
        orderNumber: stored.orderNumber,
        workHours: stored.workHours.toString(),
        lineCount: stored.lineCount,
        hasMaterialCostNote: stored.hasMaterialCostNote,
        hasComment: stored.hasComment,
        draftInvoice: stored.draftInvoice
          ? {
              created: stored.draftInvoice.created,
              updated: stored.draftInvoice.updated,
              skipped: stored.draftInvoice.skipped,
              reason: stored.draftInvoice.reason ?? null,
              invoiceId: stored.draftInvoice.invoiceId ?? null,
              invoiceNumber: stored.draftInvoice.invoiceNumber ?? null,
            }
          : null,
      },
      { status: stored.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof VisitReportParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Visit report intake failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { error: "The visit report could not be stored." },
      { status: 500 },
    );
  }
}
