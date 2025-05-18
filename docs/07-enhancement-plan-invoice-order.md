# Enhancement Plan: Invoice & Order Modules (Q2 2024)

This document outlines the planned enhancements and fixes for the Invoice and Order modules, based on recent user feedback and feature requests.

## 1. Order Discount Fields

**Requirement:** Add discount capabilities (percentage and amount) to orders, applicable to both Work Orders and Quotations, with a primary focus on Quotations.

**Schema Changes:**
- **`Order` model:**
  - `overallDiscountPercentage`: `Decimal?` (Optional overall discount percentage for the order)
  - `overallDiscountAmount`: `Decimal?` (Optional overall flat discount amount for the order)
- **`OrderItem` model:**
  - `discountPercentage`: `Decimal?` (Optional discount percentage for the specific item line)
  - `discountAmount`: `Decimal?` (Optional flat discount amount for the specific item line)

**tRPC Changes:**
- Update `createOrderSchema` and `updateOrderSchema` in `src/lib/schemas/order.schema.ts` to include the new discount fields.
- Modify the `order.create` and `order.update` tRPC procedures in `src/lib/api/routers/order.ts` to handle saving and applying these discounts.
- Business logic will need to clarify how overall and item-level discounts interact (e.g., are they cumulative, or does one override the other?).

**UI Changes (`OrderForm.tsx`):**
- Add input fields for `overallDiscountPercentage` and `overallDiscountAmount` at the order level.
- Add input fields for `discountPercentage` and `discountAmount` for each item in the items table.
- Update total calculations to reflect applied discounts.

**Notes:**
- The system should prevent negative totals.
- For Work Orders, these discount fields might be captured but not affect the displayed financial values if prices are generally hidden on WOs.

## 2. Finvoice Fields for Invoice Creation

**Reference:** Finvoice 3.0 Implementation Guidelines.

### 2.1. Payment Terms

**Requirement:** Implement Finvoice-compliant payment terms. This includes standard selections (e.g., 7, 14, 21, 30 days), a custom day input, and handling for "HETI" (Immediate) payment. For "HETI", the `dueDate` will equal the `invoiceDate`.

**Schema Changes (`Invoice` model):**
- `paymentTermsType`: `InvoicePaymentTermsType` (New Enum: e.g., `NET_DAYS`, `IMMEDIATE`, `CASH_ON_DELIVERY`, `CUSTOM_DAYS`)
- `paymentTermsDays`: `Int?` (Number of days, used if `paymentTermsType` is `NET_DAYS` or `CUSTOM_DAYS`. `0` can represent `IMMEDIATE`).
- The existing `dueDate` field on `Invoice` will be calculated based on `invoiceDate` and these new payment term fields.

**tRPC Changes:**
- Update `createInvoiceSchema` and relevant procedures in `src/lib/api/routers/invoice.ts`.

**UI Changes (Invoice Creation Form):**
- Add a dropdown for `paymentTermsType` with options like "Net 7 days", "Net 14 days", "Net 30 days", "Immediate Payment", "Cash on Delivery", "Custom".
- If "Custom" or "Net X days" implies a variable number of days, provide an input field for `paymentTermsDays`.
- The `dueDate` field should be auto-calculated and displayed.

### 2.2. Delivery Terms Text

**Requirement:** Add a `DeliveryTermsText` field, as a free text input, with a suggestion for users (e.g., "EXW").

**Schema Changes (`Invoice` model):**
- `deliveryTermsText`: `String?` (Optional free text for delivery terms)

**tRPC Changes:**
- Update `createInvoiceSchema` in `src/lib/schemas/invoice.schema.ts`.
- Modify `invoice.create` procedure.

**UI Changes (Invoice Creation Form):**
- Add a text input field for `deliveryTermsText`.
- Include a placeholder or helper text, e.g., "e.g., EXW, FOB, DAP (Incoterms 2020)".
- **Finvoice Reference:** Corresponds to `DeliveryDetails/DeliveryTerms/DeliveryTermsText`. Future enhancement could include `DeliveryTermsCode` for structured Incoterms.

## 3. Finvoice Calculated Totals & Invoice Item Enhancements

**Reference:** Finvoice 3.0 Implementation Guidelines (e.g., section "Invoice calculation rules").

### 3.1. Calculated Invoice Totals

**Requirement:** Calculate and display key invoice totals: Gross Total (Vat Included), Total VAT, and Net Total (Vat Excluded), along with a breakdown of VAT per VAT percentage.

**Schema Changes (`Invoice` model):**
- `totalAmountVatExcluded`: `Decimal` (Net total of the invoice)
- `totalVatAmount`: `Decimal` (Total VAT amount for the invoice)
- `totalAmountVatIncluded`: `Decimal` (Gross total of the invoice, should align with existing `totalAmount` if that represents gross)
- `vatBreakdown`: `Json?` (To store VAT breakdown, e.g., `[{ rate: 24, basis: 100, amount: 24 }, { rate: 10, basis: 50, amount: 5 }]`)
  Alternatively, a related table `InvoiceVatBreakdown` (`id`, `invoiceId`, `vatRatePercent`, `vatBasisAmount`, `vatAmountCalculated`) for a more structured approach. The related table is preferred.

**tRPC & Logic Changes:**
- Implement calculation logic (likely in `invoice.create` and `invoice.update` tRPC procedures, or as utility functions) to compute these totals based on `InvoiceItem` data (price, quantity, VAT rate).
- Store these calculated values on the `Invoice` record.

**UI Changes (Invoice Form & View):**
- Clearly display `totalAmountVatExcluded`, `totalVatAmount`, and `totalAmountVatIncluded`.
- Display the VAT breakdown (e.g., "VAT 24%: €X.XX (from basis €Y.YY)").

### 3.2. RowFreeText for Invoice Items

**Requirement:** Allow optional free text descriptions for each invoice item row.

**Schema Changes (`InvoiceItem` model):**
- `rowFreeTexts`: `String[]` (Array of strings, as Finvoice allows multiple `RowFreeText` elements per row)

**tRPC Changes:**
- Update `invoiceItemSchema` within `createInvoiceSchema` / `updateInvoiceSchema`.
- Adjust `invoice.create` / `invoice.update` procedures.

**UI Changes (Invoice Creation Form):**
- For each invoice item row, provide a mechanism (e.g., a small text area or an "add description" button revealing input fields) to add one or more lines of free text.

## 4. Customer Creation Enhancements

### 4.1. E-Invoice Intermediator Code

**Requirement:** Add an optional field for the customer's e-invoice intermediator code, preferably with a dropdown for common Finnish operators. The provided link `https://verkkolaskuosoite.fi/client/#/info` is a search portal and does not offer a direct list of operator codes.

**Schema Changes (`Customer` model):**
- `eInvoiceIntermediatorCode`: `String?` (The actual code, e.g., "BASWFIHB")
- `eInvoiceIntermediatorName`: `String?` (Optional name of the intermediator, e.g., "Basware Oyj")

**UI Changes (Customer Form):**
- Add a dropdown for `eInvoiceIntermediatorCode` with common options:
  - Apix Messaging Oy (`003723327487`)
  - Basware Oyj (`BASWFIHB`)
  - Maventa (`003721291126` or `MAVEFIHH`)
  - Nordea Bank Abp (`NDEAFIHH`)
  - OP Yrityspankki Oyj (`OKOYFIHH`)
  - Danske Bank A/S, Suomen sivuliike (`DABAFIHH`)
  - Posti Messaging Oy / OpusCapita (`PSPBFIHH`)
- Include an "Other" option that, when selected, reveals a free text input for `eInvoiceIntermediatorCode` and `eInvoiceIntermediatorName`.

### 4.2. Country Code

**Requirement:** Add a country code dropdown in customer creation.

**Schema Changes (`Customer` model):**
- `country`: `String?` (Stores ISO 3166-1 alpha-2 country code, e.g., "FI", "SE")

**UI Changes (Customer Form):**
- Add a dropdown field for `country`, populated with a list of countries (name and code).

## 5. Order Creation Flow, Statuses, Modals, PDF, Breadcrumbs & Errors

### 5.1. Order Statuses & Flow Documentation

**Task:**
- Analyze the existing `OrderStatus` enum in `prisma/schema.prisma`.
- Document the intended lifecycle/flow for:
  - **Quotations:** e.g., Draft -> Sent -> Accepted / Rejected / Converted to Work Order.
  - **Work Orders:** e.g., Draft -> Confirmed -> In Production -> Shipped -> (Ready for Invoicing) -> Invoiced -> Completed.
- This documentation can reside in `docs/03-user-business-flows.md` or this document.

### 5.2. Order Submission Modals

**Requirement:** After successfully saving an order (create or update), present a modal with options for next steps and then redirect to the order's detail page (`/orders/[id]`).

**UI Changes (`OrderForm.tsx` on successful submission):**
- **For Quotations:**
  - Modal title: "Quotation Saved"
  - Options:
    - Button: "Mark as Sent" (Action: update order status to `sent`, then redirect)
    - Button: "Keep as Draft" (Action: redirect)
- **For Work Orders:**
  - Modal title: "Work Order Saved"
  - Options:
    - Button: "Confirm and Send to Production" (Action: update order status to `confirmed` or `in_production`, then redirect)
    - Button: "Keep as Draft" (Action: redirect)

**tRPC Changes:**
- Potentially a new small tRPC procedure or an update to existing ones might be needed if the status update is complex or requires specific side effects not covered by the standard `order.updateStatus`. Simpler status updates can use `order.updateStatus`.

### 5.3. PDF Export Button for Orders

**Requirement:** Add a button on the specific order page (`/orders/[id]`) to download a PDF version of Quotations and Work Orders.

**UI Changes (Order View Page - `/orders/[id]`):**
- Add a "Download PDF" button.

**Backend Plan:**
- This is a significant feature requiring a PDF generation strategy.
- **Phase 1 (Current Plan):** Implement the UI button.
- **Phase 2 (Future Work):**
  - Choose a PDF generation library (e.g., `react-pdf/renderer` for client-side generation if simple, or a server-side library like Puppeteer via a tRPC mutation for more complex/styled PDFs).
  - Design PDF templates for quotations and work orders.
  - Implement the tRPC endpoint and logic for generating and returning the PDF.

### 5.4. Hydration Error (`<div>` cannot be a descendant of `<p>`)

**Requirement:** Fix this React hydration error, which occurs when attempting to edit an order's status. The error trace suggests the issue is within a `<DialogContent>` component.

**Investigation Plan:**
1. Identify the component(s) responsible for rendering the "edit order status" UI, particularly any dialogs.
2. Inspect the JSX structure within these components for instances where a `<div>` or similar block-level element is nested directly inside a `<p>` tag.
3. Correct the HTML structure. Common fixes involve changing the `<p>` to a `<div>` or restructuring the content so block elements are not children of inline/paragraph elements where inappropriate.

### 5.5. Edit Order Error (Previously "attached error")

**Status:** An "attached error" was mentioned previously when editing an order. Recent fixes related to `Decimal` serialization in `OrderForm.tsx` and `EditOrderFormLoader.tsx` may have resolved this.
**Plan:** Assume this is resolved for now. If the error persists after other planned changes, further investigation will be required, and the specific error message will be needed.

### 5.6. Breadcrumbs on Order Pages

**Requirement:** Display the formatted order number (e.g., "ORD-00001") instead of the raw database ID in breadcrumbs on order-related pages (e.g., `/orders/[id]`, `/orders/[id]/edit`).

**Plan:**
1. Identify the breadcrumb component and how it sources its data.
2. On pages like `OrderPage` or `EditOrderPage`, ensure the `Order` object (including `orderNumber`) is fetched.
3. Pass the `orderNumber` to the breadcrumb component for display.

## 6. PDF Formatting for Quotations and Work Orders

**Requirement:** User inquired if ready PDF formatting exists.
**Status & Plan:** Assume not fully implemented. This is tied to item 5.3 (PDF Export Button). The creation of well-formatted PDFs is a distinct sub-project within that feature. Templates and styling will need to be developed.

## 7. Layout Width Adjustment (Layout Shift / Auto Width Jumping)

**Requirement:** Implement a fixed width (full screen) for the application to prevent content jumping and layout shifts that occur between skeleton/loading states, no content states, and final content rendering.

**Investigation Points (based on user suggestion to check file with "Sign Out" button):**
- The "Sign Out" button is likely located in a persistent layout component, such as:
  - `src/app/(erp)/layout.tsx` (ERP-specific layout)
  - `src/app/layout.tsx` (Global layout)
  - `src/components/layout/Header.tsx`
  - `src/components/layout/Sidebar.tsx` (if the main content area is a child of this)
- **Primary Suspects for Layout Shift:**
  1.  **Main Content Wrapper:** The primary `<div>` or `<main>` tag that wraps the page content in these layout files might be missing `width: 100%` (`w-full` in Tailwind) or a consistent `max-w-` class.
  2.  **Skeleton Component Sizing:** Skeleton loaders for various sections might not have dimensions (especially width) that match the final content, causing reflow when real content loads.
  3.  **Conditional Rendering of Major Layout Blocks:** If large parts of the layout (e.g., sidebars, footers) are conditionally rendered without placeholders, the main content area might expand/contract.

**Proposed Fix Strategy:**
1.  **Inspect Layout Files:** Examine `src/app/(erp)/layout.tsx` and `src/app/layout.tsx`. Ensure the main content wrapper has `className="w-full"`.
2.  **Full Screen Width:** To achieve "full screen" width, ensure no overly restrictive `max-w-` classes (like `max-w-7xl`) are applied to the outermost page container if a truly edge-to-edge screen fill is desired. If a maximum content width is still desired but within a full-width viewport, the structure would be `body/root-div (w-full) -> inner-container (max-w-..., mx-auto)`. The user's request for "fixed width of full screen" implies `w-full` on the main content area.
3.  **Skeleton Review:** Ensure that major skeleton components (especially those for lists, tables, or large content blocks) also use `w-full` or have defined widths that prevent their container from collapsing or being too narrow initially.
4.  **CSS Consistency:** Verify that global styles or other CSS isn't unexpectedly overriding Tailwind's width utilities.

This plan will be used to guide the next steps in development.

## 8. Inventory and BOM Enhancements

### 8.1. Excel Import for Raw Material Data

**Requirement:** Allow users to import raw material data into the Inventory module from an Excel file. This should facilitate bulk creation and updates of inventory items.

**Considerations:**
- **Tooling:** Investigate using a library like `XToolset` (or similar, e.g., `xlsx`) for parsing Excel files.
- **Mapping:** Provide a clear template or UI for mapping Excel columns to `InventoryItem` fields (e.g., `name`, `supplierCode`, `purchasePrice`, `salesPrice`, `quantity`, `unit`, `category`, etc.).
- **Error Handling:** Robust error reporting for rows that fail validation or import.
- **tRPC Endpoint:** A new tRPC mutation will be needed to handle the file upload and data processing.
- **Security:** Ensure proper validation of uploaded files and their content.

**Schema Impact (`InventoryItem`):**
- No immediate schema changes, but the import process will populate existing fields. Consider adding fields like `lastImportedAt` or `importBatchId` if tracking import history is needed.

### 8.2. In-Table Editing for Inventory

**Requirement:** Enable direct in-table editing for key fields in the Inventory list view, specifically for `quantity`, `purchasePrice`, and `salesPrice`.

**UI Changes:**
- Modify the inventory table (likely using a component like TanStack Table) to make specified cells editable.
- Provide clear visual cues for editable cells and a mechanism to save changes (e.g., on blur, or an explicit "Save" button per row or for the table).

**tRPC Changes:**
- An `updateInventoryItem` tRPC mutation is likely already present. Ensure it can handle partial updates for these fields efficiently. Batch update capabilities could be considered for performance if users edit many rows simultaneously.

### 8.3. Bill of Materials (BOM) Management Enhancements

**Requirement:** Improve the BOM management view with the following capabilities:
    - **Linking Inventory Items:** Allow users to easily link constituent inventory items (raw materials, sub-assemblies) to a parent producible item. This should involve a user-friendly interface, possibly with checkboxes, search/filter functionality for inventory items.
    - **Inventory Deduction on Shipment:** When a Work Order for a BOM-based product is marked as "Shipped", the system should automatically deduct the quantities of the linked constituent inventory items from stock.
    - **BOM Cost Calculation:** Calculate and display the total cost of a BOM, summing the `purchasePrice` of all constituent items (considering their quantities in the BOM). This should also factor in estimated labor costs.

**Schema Changes:**
- **`BillOfMaterialsItem` model (if not already granular enough):**
    - `parentId`: ID of the producible `InventoryItem`.
    - `childId`: ID of the constituent `InventoryItem`.
    - `quantityPerParent`: `Decimal` (e.g., 2 units of child X are needed for 1 unit of parent Y).
- **`InventoryItem` model:**
    - `isProducible`: `Boolean` (marks an item as something that can be manufactured from a BOM).
    - `estimatedLaborCost`: `Decimal?` (for producible items, to be included in BOM cost).
- **`WorkOrderItem` (if linking BOM directly to order items):**
    - `deductedFromInventoryAt`: `DateTime?` (Timestamp when constituent parts were deducted).

**tRPC & Logic Changes:**
- **BOM Creation/Editing:** New tRPC procedures for creating and managing BOM structures (linking/unlinking items, setting quantities).
- **Inventory Deduction Logic:** Service-level function or tRPC procedure triggered on order shipment status change. This needs to be robust and handle potential stock-outs gracefully (e.g., warnings, preventing shipment if insufficient stock).
- **BOM Cost Calculation:** Utility function or tRPC query to calculate BOM costs on the fly or store them if they are relatively static.

**UI Changes:**
- New or enhanced view for managing BOMs for each "producible" `InventoryItem`.
- Clear display of calculated BOM costs.
- Visual feedback during the inventory deduction process (or logs for admins).

### 8.4. Reiteration: Inventory Alert Table & Dashboard Visualizations

**Requirement:** Re-emphasize the need for:
    - **Inventory Alert Table:** A dedicated view or dashboard widget showing items that are below their reorder point or out of stock.
    - **Dashboard Visualizations:** Charts and graphs on the main dashboard related to inventory levels, turnover, aging, and potentially sales trends linked to inventory.

**Notes:** These were likely documented earlier (e.g., in `README.md` or other planning docs) but are reiterated here for consolidated planning. Implementation would involve:
- **Schema:** `InventoryItem` likely needs `reorderPoint` and `minimumStockLevel` fields.
- **tRPC:** Queries to fetch data for alerts and visualizations.
- **UI:** New components for the alert table and dashboard widgets (using a charting library). 