import { parseNordicNumber } from "@/lib/utils/nordic-numbers";

const MAX_LINES = 200;
const MAX_ITEM_LENGTH = 300;
const MAX_NOTE_LENGTH = 4000;
const MAX_COMMENT_LENGTH = 8000;
const MAX_UNIT_LENGTH = 40;
const MAX_PRODUCT_NUMBER_LENGTH = 80;
const MAX_ID_LENGTH = 120;
const MAX_ORDER_NUMBER_LENGTH = 80;

export class VisitReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitReportParseError";
  }
}

export interface ParsedVisitReportLine {
  position: number;
  item: string;
  quantity: number;
  unit: string | null;
  productNumber: string | null;
}

export interface ParsedVisitReport {
  externalVisitId: string;
  orderNumber: string | null;
  workHours: number;
  materialCostNote: string | null;
  comment: string | null;
  markedDoneAt: Date | null;
  /** Null when Scheduling omits lines (unchanged from the work order). Empty array clears lines. */
  lines: ParsedVisitReportLine[] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstPresent(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function unwrapReport(body: Record<string, unknown>): Record<string, unknown> {
  const hasReportFields =
    firstPresent(body, ["workHours", "work_hours", "hours"]) !== undefined ||
    firstPresent(body, ["lines", "orderLines", "order_lines", "items"]) !== undefined;

  if (hasReportFields) {
    return body;
  }

  for (const key of ["report", "visit", "payload", "data"] as const) {
    const nested = body[key];
    if (isRecord(nested)) {
      return nested;
    }
  }

  return body;
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new VisitReportParseError(`${label} is missing.`);
  }
  const text = String(value).trim();
  if (!text) {
    throw new VisitReportParseError(`${label} is missing.`);
  }
  if (text.length > maxLength) {
    throw new VisitReportParseError(`${label} is too long.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new VisitReportParseError(`${label} must be text.`);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    throw new VisitReportParseError(`${label} is too long.`);
  }
  return text;
}

function requireHours(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    throw new VisitReportParseError("Work hours are missing. Send workHours.");
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new VisitReportParseError("Work hours must be a number.");
  }
  const hours = parseNordicNumber(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 999) {
    throw new VisitReportParseError("Work hours must be a number from 0 to 999.");
  }
  return Math.round(hours * 100) / 100;
}

function requireQuantity(value: unknown, lineNumber: number): number {
  if (value === undefined || value === null || value === "") {
    throw new VisitReportParseError(`Line ${lineNumber} is missing a quantity.`);
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new VisitReportParseError(`Line ${lineNumber} quantity must be a number.`);
  }
  const quantity = parseNordicNumber(value);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
    throw new VisitReportParseError(`Line ${lineNumber} quantity must be zero or greater.`);
  }
  return Math.round(quantity * 1000) / 1000;
}

function parseWhen(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new VisitReportParseError("The done time must be a date.");
  }
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) {
    throw new VisitReportParseError("The done time is not a valid date.");
  }
  return when;
}

function parseLine(value: unknown, index: number): ParsedVisitReportLine {
  const lineNumber = index + 1;
  if (!isRecord(value)) {
    throw new VisitReportParseError(`Line ${lineNumber} is not a line item.`);
  }

  const item = optionalText(
    firstPresent(value, ["item", "name", "itemName", "item_name", "description"]),
    `Line ${lineNumber} item`,
    MAX_ITEM_LENGTH,
  );
  if (!item) {
    throw new VisitReportParseError(`Line ${lineNumber} is missing the item name.`);
  }

  return {
    position: index,
    item,
    quantity: requireQuantity(
      firstPresent(value, ["quantity", "qty"]),
      lineNumber,
    ),
    unit: optionalText(
      firstPresent(value, ["unit", "unitOfMeasure", "unit_of_measure", "uom"]),
      `Line ${lineNumber} unit`,
      MAX_UNIT_LENGTH,
    ),
    productNumber: optionalText(
      firstPresent(value, ["productNumber", "product_number", "productNo", "product_no", "sku"]),
      `Line ${lineNumber} product number`,
      MAX_PRODUCT_NUMBER_LENGTH,
    ),
  };
}

/**
 * Reads a visit-done body into the fields books stores.
 * Key names follow the report Scheduling is described as sending.
 * Snake case and a single wrapper object are accepted so small naming differences still land.
 */
export function parseVisitDonePayload(body: unknown): ParsedVisitReport {
  if (!isRecord(body)) {
    throw new VisitReportParseError("The visit report must be an object.");
  }

  const report = unwrapReport(body);
  const externalVisitId = optionalText(
    firstPresent(report, ["visitId", "externalVisitId", "visit_id", "external_visit_id"]),
    "Visit id",
    MAX_ID_LENGTH,
  );
  if (!externalVisitId) {
    throw new VisitReportParseError("Visit id is missing. Send visitId.");
  }

  const linesRaw = firstPresent(report, ["lines", "orderLines", "order_lines", "items"]);
  let lines: ParsedVisitReportLine[] | null = null;
  if (linesRaw !== undefined) {
    if (!Array.isArray(linesRaw)) {
      throw new VisitReportParseError("Order lines must be a list.");
    }
    if (linesRaw.length > MAX_LINES) {
      throw new VisitReportParseError(`A visit report can include at most ${MAX_LINES} lines.`);
    }
    lines = linesRaw.map((line, index) => parseLine(line, index));
  }

  return {
    externalVisitId,
    orderNumber: optionalText(
      firstPresent(report, ["orderNumber", "order_number", "workOrderNumber", "work_order_number"]),
      "Order number",
      MAX_ORDER_NUMBER_LENGTH,
    ),
    workHours: requireHours(firstPresent(report, ["workHours", "work_hours", "hours"])),
    materialCostNote: optionalText(
      firstPresent(report, ["materialCostNote", "material_cost_note", "materialNote", "material_note"]),
      "Material cost note",
      MAX_NOTE_LENGTH,
    ),
    comment: optionalText(
      firstPresent(report, ["comment", "comments"]),
      "Comment",
      MAX_COMMENT_LENGTH,
    ),
    markedDoneAt: parseWhen(
      firstPresent(report, ["markedDoneAt", "marked_done_at", "completedAt", "completed_at", "doneAt"]),
    ),
    lines,
  };
}
