import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildVisitInvoiceNotes,
  nextInvoiceNumberFromLast,
  planInvoiceLinesFromVisit,
} from "./draft-invoice-from-visit";

describe("planInvoiceLinesFromVisit", () => {
  it("bills order lines and overrides quantity when the visit SKU matches", () => {
    const planned = planInvoiceLinesFromVisit({
      orderItems: [
        {
          inventoryItemId: "inv-seal",
          sku: "IKK-TIIV-6",
          name: "Window seal 6 m",
          quantity: 1,
          unitPrice: 40,
          vatRatePercent: 25.5,
          costPrice: 10,
          discountAmount: null,
          discountPercentage: null,
        },
        {
          inventoryItemId: "inv-filter",
          sku: "FILTER-1",
          name: "Filter set",
          quantity: 1,
          unitPrice: 20,
          vatRatePercent: 25.5,
          costPrice: 5,
          discountAmount: null,
          discountPercentage: null,
        },
      ],
      reportLines: [
        { item: "Window seal 6 m", quantity: 2, productNumber: "IKK-TIIV-6" },
      ],
      extraInventoryBySku: new Map(),
      companyDefaultVatRate: 25.5,
    });

    assert.equal(planned.lines.length, 2);
    assert.equal(planned.lines[0]?.quantity, 2);
    assert.equal(planned.lines[1]?.quantity, 1);
    assert.equal(planned.unmatchedReportLines.length, 0);
  });

  it("sums quantities when the same visit SKU appears twice", () => {
    const planned = planInvoiceLinesFromVisit({
      orderItems: [
        {
          inventoryItemId: "inv-seal",
          sku: "IKK-TIIV-6",
          name: "Window seal 6 m",
          quantity: 1,
          unitPrice: 40,
          vatRatePercent: 25.5,
          costPrice: 10,
          discountAmount: null,
          discountPercentage: null,
        },
      ],
      reportLines: [
        { item: "Window seal 6 m", quantity: 2, productNumber: "IKK-TIIV-6" },
        { item: "Window seal 6 m", quantity: 1.5, productNumber: "ikk-tiiv-6" },
      ],
      extraInventoryBySku: new Map(),
      companyDefaultVatRate: 25.5,
    });

    assert.equal(planned.lines[0]?.quantity, 3.5);
  });

  it("adds an extra stock line and notes unmatched free text", () => {
    const planned = planInvoiceLinesFromVisit({
      orderItems: [
        {
          inventoryItemId: "inv-seal",
          sku: "IKK-TIIV-6",
          name: "Window seal 6 m",
          quantity: 1,
          unitPrice: 40,
          vatRatePercent: 25.5,
          costPrice: 10,
          discountAmount: null,
          discountPercentage: null,
        },
      ],
      reportLines: [
        { item: "Sealant tube", quantity: 1.5, productNumber: "SEAL-18" },
        { item: "Borrowed ladder fee", quantity: 1, productNumber: null },
      ],
      extraInventoryBySku: new Map([
        [
          "SEAL-18",
          {
            id: "inv-sealant",
            name: "Sealant tube",
            salesPrice: 12,
            costPrice: 4,
            defaultVatRatePercent: 25.5,
          },
        ],
      ]),
      companyDefaultVatRate: 25.5,
    });

    assert.equal(planned.lines.length, 2);
    assert.equal(planned.lines[1]?.inventoryItemId, "inv-sealant");
    assert.equal(planned.lines[1]?.quantity, 1.5);
    assert.equal(planned.lines[1]?.source, "report-extra");
    assert.equal(planned.unmatchedReportLines.length, 1);
    assert.match(planned.unmatchedReportLines[0] ?? "", /Borrowed ladder fee/);
  });
});

describe("buildVisitInvoiceNotes", () => {
  it("puts hours, notes, and unmatched lines into the draft note", () => {
    const notes = buildVisitInvoiceNotes({
      workHours: 4.5,
      materialCostNote: "One extra tube, about 18 euros.",
      comment: "Leave old trim in the garage.",
      unmatchedReportLines: ["Borrowed ladder fee (qty 1)"],
    });

    assert.match(notes, /Work hours: 4\.5/);
    assert.match(notes, /18 euros/);
    assert.match(notes, /old trim/);
    assert.match(notes, /Borrowed ladder fee/);
  });
});

describe("nextInvoiceNumberFromLast", () => {
  it("increments a padded invoice number", () => {
    assert.equal(nextInvoiceNumberFromLast("INV-00002"), "INV-00003");
    assert.equal(nextInvoiceNumberFromLast(null), "INV-00001");
  });
});
