import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { schedulingSecretMatches } from "./intake-auth";
import { parseVisitDonePayload, VisitReportParseError } from "./parse-visit-done";

const fictionalReport = {
  visitId: "visit-2026-0142",
  orderNumber: "WO-2026-0142",
  workHours: "4,5",
  materialCostNote: "One extra tube of window sealant, about 18 euros, was used on the north frame.",
  comment: "The homeowner was home and asked the crew to leave the old trim in the garage.",
  markedDoneAt: "2026-10-14T15:30:00.000Z",
  lines: [
    { item: "Window seal 6 m", quantity: 2, unit: "pcs", productNumber: "IKK-TIIV-6" },
    { item: "Sealant tube", quantity: "1,5", unit: "pcs", productNumber: "SEAL-18" },
  ],
};

describe("parseVisitDonePayload", () => {
  it("stores hours, lines, the material note, and the comment from a finished visit", () => {
    const parsed = parseVisitDonePayload(fictionalReport);

    assert.equal(parsed.externalVisitId, "visit-2026-0142");
    assert.equal(parsed.orderNumber, "WO-2026-0142");
    assert.equal(parsed.workHours, 4.5);
    assert.match(parsed.materialCostNote ?? "", /18 euros/);
    assert.match(parsed.comment ?? "", /old trim/);
    assert.equal(parsed.lines.length, 2);
    assert.deepEqual(
      parsed.lines.map((line) => ({
        item: line.item,
        quantity: line.quantity,
        unit: line.unit,
        productNumber: line.productNumber,
      })),
      [
        { item: "Window seal 6 m", quantity: 2, unit: "pcs", productNumber: "IKK-TIIV-6" },
        { item: "Sealant tube", quantity: 1.5, unit: "pcs", productNumber: "SEAL-18" },
      ],
    );
  });

  it("accepts snake_case names for the same report fields", () => {
    const parsed = parseVisitDonePayload({
      visit_id: "visit-2026-0143",
      order_number: "WO-2026-0143",
      work_hours: 2,
      material_cost_note: "No extra material.",
      comment: "Gate code worked.",
      lines: [
        { item_name: "Hinge", qty: 4, unit_of_measure: "pcs", product_number: "HINGE-4" },
      ],
    });

    assert.equal(parsed.externalVisitId, "visit-2026-0143");
    assert.equal(parsed.workHours, 2);
    assert.equal(parsed.lines[0]?.productNumber, "HINGE-4");
    assert.equal(parsed.lines[0]?.quantity, 4);
  });

  it("rejects a report that does not include hours", () => {
    assert.throws(
      () => parseVisitDonePayload({ visitId: "visit-1", lines: [] }),
      (error: unknown) => error instanceof VisitReportParseError && /hours/i.test(error.message),
    );
  });
});

describe("schedulingSecretMatches", () => {
  it("accepts only the configured secret", () => {
    assert.equal(schedulingSecretMatches("correct-secret-value", "correct-secret-value"), true);
    assert.equal(schedulingSecretMatches("wrong-secret-value", "correct-secret-value"), false);
    assert.equal(schedulingSecretMatches(null, "correct-secret-value"), false);
  });
});
