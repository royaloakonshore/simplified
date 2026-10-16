import { NextResponse } from "next/server";

import { bearerToken, schedulingSecretMatches } from "@/lib/integrations/scheduling/intake-auth";
import {
  LeadCustomerError,
  intakeLeadCustomer,
  leadIntakeCompanyId,
  leadIntakeSecret,
} from "@/lib/integrations/lead-studio/intake-customer";
import { prismaLeadIntakeStore } from "@/lib/integrations/lead-studio/store-lead-customer";

export async function POST(request: Request) {
  const secret = leadIntakeSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Lead intake is not configured." },
      { status: 503 },
    );
  }

  const provided = bearerToken(request.headers.get("authorization"));
  if (!schedulingSecretMatches(provided, secret)) {
    return NextResponse.json(
      { error: "Lead Studio was not recognized." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The lead was not valid JSON." },
      { status: 400 },
    );
  }

  try {
    const saved = await intakeLeadCustomer(body, prismaLeadIntakeStore(), {
      configuredCompanyId: leadIntakeCompanyId(),
    });
    return NextResponse.json(
      {
        ok: true,
        created: saved.created,
        customerId: saved.id,
        customerNumber: saved.customerNumber,
      },
      { status: saved.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof LeadCustomerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Lead customer intake failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { error: "The customer could not be saved." },
      { status: 500 },
    );
  }
}
