import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { schedulingSecretMatches } from "@/lib/integrations/scheduling/intake-auth";
import {
  LeadCustomerError,
  chooseIntakeCompany,
  containsProductionCustomerMarker,
  intakeLeadCustomer,
  nextCustomerNumber,
  parseLeadCustomer,
  pickReusableCustomer,
  readLeadIntakeSecret,
  type LeadIntakeStore,
  type ParsedLeadCustomer,
  type SavedLeadCustomer,
} from "@/lib/integrations/lead-studio/intake-customer";

const fictionalLead = {
  name: "Example Lead Oy",
  email: "Lead@example.test",
  phone: "+358400000000",
  vatId: "0000000-0",
  language: "FI",
  buyerReference: "lead-studio:prospect-example-1",
  leadStudioProspectId: "prospect-example-1",
  address: {
    street: "Example Street 1",
    city: "Testville",
    postalCode: "00000",
    country: "FI",
  },
};

function memoryStore(options?: {
  companies?: Array<{ id: string; name: string; businessId: string | null }>;
  existing?: SavedLeadCustomer | null;
}): { store: LeadIntakeStore; saved: ParsedLeadCustomer[] } {
  const saved: ParsedLeadCustomer[] = [];
  const companies = options?.companies ?? [
    { id: "company-example", name: "Example Books", businessId: null },
  ];
  const store: LeadIntakeStore = {
    async findCompanyById(id) {
      return companies.find((company) => company.id === id) ?? null;
    },
    async listCompanies(take) {
      return companies.slice(0, take);
    },
    async save(_companyId, lead) {
      saved.push(lead);
      return (
        options?.existing ?? {
          created: true,
          id: "customer-example",
          customerNumber: "010",
        }
      );
    },
  };
  return { store, saved };
}

describe("parseLeadCustomer", () => {
  it("reads the lead fields books already stores", () => {
    const parsed = parseLeadCustomer(fictionalLead);

    assert.equal(parsed.name, "Example Lead Oy");
    assert.equal(parsed.email, "lead@example.test");
    assert.equal(parsed.phone, "+358400000000");
    assert.equal(parsed.vatId, "0000000-0");
    assert.equal(parsed.language, "FI");
    assert.equal(parsed.buyerReference, "lead-studio:prospect-example-1");
    assert.deepEqual(parsed.billingAddress, {
      streetAddress: "Example Street 1",
      city: "Testville",
      postalCode: "00000",
      countryCode: "FI",
    });
    assert.ok(parsed.vatLookup.includes("FI00000000"));
  });

  it("builds the lead reference and skips a partial address", () => {
    const parsed = parseLeadCustomer({
      name: "Example Person",
      leadStudioProspectId: "prospect-example-2",
      address: { street: "Example Street 2" },
    });

    assert.equal(parsed.buyerReference, "lead-studio:prospect-example-2");
    assert.equal(parsed.billingAddress, null);
    assert.equal(parsed.language, "FI");
  });

  it("rejects a lead with no name", () => {
    assert.throws(
      () => parseLeadCustomer({ email: "lead@example.test" }),
      (error: unknown) => error instanceof LeadCustomerError && error.status === 400,
    );
  });
});

describe("production customer markers", () => {
  it("recognises the production names already used for this books boundary", () => {
    assert.equal(containsProductionCustomerMarker("Talosofta Oy"), true);
    assert.equal(containsProductionCustomerMarker("Lämpöpartio"), true);
    assert.equal(containsProductionCustomerMarker("Example Lead Oy"), false);
  });

  it("refuses a lead that names a production customer", () => {
    assert.throws(
      () => parseLeadCustomer({ ...fictionalLead, email: "office@talosofta.example" }),
      (error: unknown) => error instanceof LeadCustomerError && error.status === 422,
    );
  });
});

describe("reuse and company choice", () => {
  const lead = parseLeadCustomer(fictionalLead);

  it("reuses the organisation number before a different email", () => {
    const picked = pickReusableCustomer(
      [
        {
          id: "by-email",
          customerNumber: "010",
          email: "lead@example.test",
          vatId: null,
          buyerReference: null,
        },
        {
          id: "by-vat",
          customerNumber: "011",
          email: "other@example.test",
          vatId: "FI00000000",
          buyerReference: null,
        },
      ],
      { ...lead, buyerReference: null },
    );

    assert.equal(picked?.id, "by-vat");
  });

  it("uses the only books company and refuses to guess among several", () => {
    const only = chooseIntakeCompany(null, [
      { id: "company-example", name: "Example Books", businessId: null },
    ]);
    assert.equal(only.id, "company-example");

    assert.throws(
      () =>
        chooseIntakeCompany(null, [
          { id: "company-a", name: "Example A", businessId: null },
          { id: "company-b", name: "Example B", businessId: null },
        ]),
      (error: unknown) => error instanceof LeadCustomerError && error.status === 503,
    );
  });

  it("assigns the next customer number the same way as the books form", () => {
    assert.equal(nextCustomerNumber(null), "010");
    assert.equal(nextCustomerNumber("010"), "011");
  });
});

describe("intakeLeadCustomer", () => {
  it("saves a made-up lead on the only company", async () => {
    const { store, saved } = memoryStore();
    const result = await intakeLeadCustomer(fictionalLead, store, { configuredCompanyId: null });

    assert.equal(result.created, true);
    assert.equal(result.id, "customer-example");
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.billingAddress?.streetAddress, "Example Street 1");
  });

  it("returns the existing customer when the store reuses one", async () => {
    const { store, saved } = memoryStore({
      existing: { created: false, id: "customer-existing", customerNumber: "014" },
    });
    const result = await intakeLeadCustomer(fictionalLead, store, { configuredCompanyId: null });

    assert.equal(result.created, false);
    assert.equal(result.id, "customer-existing");
    assert.equal(saved.length, 1);
  });

  it("does not save when the books company itself is a production company", async () => {
    const { store, saved } = memoryStore({
      companies: [{ id: "company-live", name: "Talosofta", businessId: null }],
    });

    await assert.rejects(
      () => intakeLeadCustomer(fictionalLead, store, { configuredCompanyId: null }),
      (error: unknown) => error instanceof LeadCustomerError && error.status === 422,
    );
    assert.equal(saved.length, 0);
  });
});

describe("lead intake secret", () => {
  it("stays unset for an empty or placeholder secret", () => {
    assert.equal(readLeadIntakeSecret(undefined), null);
    assert.equal(readLeadIntakeSecret("  "), null);
    assert.equal(readLeadIntakeSecret("replace-with-a-long-random-string"), null);
    assert.equal(readLeadIntakeSecret("example-lead-secret"), "example-lead-secret");
    assert.equal(schedulingSecretMatches("example-lead-secret", "example-lead-secret"), true);
    assert.equal(schedulingSecretMatches("other-secret", "example-lead-secret"), false);
  });
});
