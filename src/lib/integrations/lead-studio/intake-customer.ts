const LANGUAGES = ["EN", "FI", "SE"] as const;
const PLACEHOLDER_SECRET = "replace-with-a-long-random-string";
const PRODUCTION_MARKERS = ["talosofta", "lampopartio"] as const;

export type LeadLanguage = (typeof LANGUAGES)[number];

export class LeadCustomerError extends Error {
  readonly status: 400 | 422 | 503;

  constructor(message: string, status: 400 | 422 | 503) {
    super(message);
    this.name = "LeadCustomerError";
    this.status = status;
  }
}

export interface LeadBillingAddress {
  streetAddress: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export interface ParsedLeadCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  vatId: string | null;
  vatLookup: string[];
  language: LeadLanguage;
  buyerReference: string | null;
  leadStudioProspectId: string | null;
  billingAddress: LeadBillingAddress | null;
}

export interface LeadIntakeCompany {
  id: string;
  name: string;
  businessId: string | null;
}

export interface SavedLeadCustomer {
  created: boolean;
  id: string;
  customerNumber: string | null;
}

export interface ReusableCustomerRow {
  id: string;
  customerNumber: string | null;
  email: string | null;
  vatId: string | null;
  buyerReference: string | null;
}

export interface LeadIntakeStore {
  findCompanyById(id: string): Promise<LeadIntakeCompany | null>;
  listCompanies(take: number): Promise<LeadIntakeCompany[]>;
  save(companyId: string, lead: ParsedLeadCustomer): Promise<SavedLeadCustomer>;
}

export function readLeadIntakeSecret(raw: string | undefined): string | null {
  const secret = raw?.trim();
  if (!secret || secret === PLACEHOLDER_SECRET) {
    return null;
  }
  return secret;
}

export function readLeadIntakeCompanyId(raw: string | undefined): string | null {
  const companyId = raw?.trim();
  return companyId ? companyId : null;
}

export function leadIntakeSecret(): string | null {
  return readLeadIntakeSecret(process.env.ERP_LEAD_INTAKE_SECRET);
}

export function leadIntakeCompanyId(): string | null {
  return readLeadIntakeCompanyId(process.env.ERP_LEAD_INTAKE_COMPANY_ID);
}

export function containsProductionCustomerMarker(value: string): boolean {
  const folded = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return PRODUCTION_MARKERS.some((marker) => folded.includes(marker));
}

export function assertNotProductionCustomer(parts: Array<string | null | undefined>): void {
  const text = parts.filter((part): part is string => Boolean(part)).join("\n");
  if (text && containsProductionCustomerMarker(text)) {
    throw new LeadCustomerError(
      "This lead matches a production customer and was not saved.",
      422,
    );
  }
}

export function nextCustomerNumber(last: string | null | undefined): string {
  if (!last) {
    return "010";
  }
  const lastNumber = parseInt(last, 10);
  if (Number.isNaN(lastNumber)) {
    return "010";
  }
  return (lastNumber + 1).toString().padStart(3, "0");
}

export function pickReusableCustomer(
  rows: ReusableCustomerRow[],
  lead: ParsedLeadCustomer,
): ReusableCustomerRow | null {
  if (lead.buyerReference) {
    const byReference = rows.find((row) => row.buyerReference === lead.buyerReference);
    if (byReference) {
      return byReference;
    }
  }

  if (lead.vatLookup.length > 0) {
    const vatKeys = new Set(lead.vatLookup.map((vatId) => vatId.toLowerCase()));
    const byVat = rows.find((row) => row.vatId !== null && vatKeys.has(row.vatId.toLowerCase()));
    if (byVat) {
      return byVat;
    }
  }

  if (lead.email) {
    const email = lead.email.toLowerCase();
    const byEmail = rows.find((row) => row.email?.toLowerCase() === email);
    if (byEmail) {
      return byEmail;
    }
  }

  return null;
}

export function chooseIntakeCompany(
  configuredId: string | null,
  companies: LeadIntakeCompany[],
): LeadIntakeCompany {
  if (configuredId) {
    const match = companies.find((company) => company.id === configuredId);
    if (!match) {
      throw new LeadCustomerError(
        "Lead intake does not know which books company to use.",
        503,
      );
    }
    return match;
  }

  const [only] = companies;
  if (companies.length === 1 && only) {
    return only;
  }

  throw new LeadCustomerError(
    "Lead intake does not know which books company to use.",
    503,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new LeadCustomerError(`${label} is not text.`, 400);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    throw new LeadCustomerError(`${label} is too long.`, 400);
  }
  return text;
}

function firstText(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string,
  maxLength: number,
): string | null {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return optionalText(record[key], label, maxLength);
    }
  }
  return null;
}

function parseLanguage(value: unknown): LeadLanguage {
  if (value === undefined || value === null || value === "") {
    return "FI";
  }
  if (typeof value !== "string") {
    throw new LeadCustomerError("Language is not recognized.", 400);
  }
  const upper = value.trim().toUpperCase();
  switch (upper) {
    case "EN":
      return "EN";
    case "FI":
      return "FI";
    case "SE":
      return "SE";
    default:
      throw new LeadCustomerError("Language is not recognized.", 400);
  }
}

function vatLookupValues(vatId: string): string[] {
  const values = new Set<string>([vatId]);
  const compact = vatId.replace(/\s+/g, "").toUpperCase();
  values.add(compact);
  const digits = compact.replace(/\D/g, "");
  if (digits.length === 8) {
    values.add(`${digits.slice(0, 7)}-${digits.slice(7)}`);
    values.add(`FI${digits}`);
  }
  return [...values];
}

function parseBillingAddress(body: Record<string, unknown>): LeadBillingAddress | null {
  const nested = body.address ?? body.billingAddress ?? body.billing;
  const source = isRecord(nested) ? nested : body;
  const streetAddress = firstText(
    source,
    ["streetAddress", "street_address", "street"],
    "Street",
    200,
  );
  const city = firstText(source, ["city"], "City", 100);
  const postalCode = firstText(
    source,
    ["postalCode", "postal_code", "postCode", "post_code"],
    "Postal code",
    20,
  );
  const countryCode = firstText(
    source,
    ["countryCode", "country_code", "country"],
    "Country",
    60,
  );

  if (!streetAddress || !city || !postalCode || !countryCode) {
    return null;
  }

  return { streetAddress, city, postalCode, countryCode };
}

export function parseLeadCustomer(raw: unknown): ParsedLeadCustomer {
  if (!isRecord(raw)) {
    throw new LeadCustomerError("The lead was not a customer record.", 400);
  }

  const name = optionalText(raw.name, "Name", 200);
  if (!name || name.length < 2) {
    throw new LeadCustomerError("A customer name is required.", 400);
  }

  const email = optionalText(raw.email, "Email", 200)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new LeadCustomerError("Email is not valid.", 400);
  }

  const phone = optionalText(raw.phone, "Phone", 40);
  const vatId = firstText(
    raw,
    ["vatId", "vat_id", "organisationNumber", "organizationNumber", "orgNumber", "yTunnus", "businessId"],
    "Organisation number",
    40,
  );
  const leadStudioProspectId = firstText(
    raw,
    ["leadStudioProspectId", "lead_studio_prospect_id", "prospectId"],
    "Lead id",
    120,
  );
  const providedReference = optionalText(raw.buyerReference ?? raw.buyer_reference, "Buyer reference", 120);
  const buyerReference =
    providedReference ?? (leadStudioProspectId ? `lead-studio:${leadStudioProspectId}` : null);
  const billingAddress = parseBillingAddress(raw);
  const language = parseLanguage(raw.language);

  const lead: ParsedLeadCustomer = {
    name,
    email,
    phone,
    vatId,
    vatLookup: vatId ? vatLookupValues(vatId) : [],
    language,
    buyerReference,
    leadStudioProspectId,
    billingAddress,
  };

  assertNotProductionCustomer([
    lead.name,
    lead.email,
    lead.phone,
    lead.vatId,
    lead.buyerReference,
    lead.leadStudioProspectId,
    lead.billingAddress?.streetAddress,
    lead.billingAddress?.city,
    lead.billingAddress?.postalCode,
    lead.billingAddress?.countryCode,
  ]);

  return lead;
}

export async function intakeLeadCustomer(
  raw: unknown,
  store: LeadIntakeStore,
  options: { configuredCompanyId: string | null },
): Promise<SavedLeadCustomer> {
  const lead = parseLeadCustomer(raw);
  const companies = options.configuredCompanyId
    ? compactCompany(await store.findCompanyById(options.configuredCompanyId))
    : await store.listCompanies(2);
  const company = chooseIntakeCompany(options.configuredCompanyId, companies);
  assertNotProductionCustomer([company.name, company.businessId]);
  return store.save(company.id, lead);
}

function compactCompany(company: LeadIntakeCompany | null): LeadIntakeCompany[] {
  return company ? [company] : [];
}
