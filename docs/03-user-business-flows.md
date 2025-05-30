# User & Business Flows - Simplified ERP System

This document details key user and business process flows within the ERP system.

**Current Context & Progress:**
The application has established user flows for core operations like login, profile updates (now robustly handles password changes and profile info updates), inventory item creation (basic, SKU handling fixed for orders), sales order creation and confirmation, invoicing from orders, and Finvoice export. The system uses tRPC for backend mutations and queries, with NextAuth for authentication. Recent work focused on build stabilization, resolving numerous type errors (all known type errors in `invoice.ts` are fixed), and ensuring VAT calculations are correct (using `InventoryItem.defaultVatRatePercent` with a fallback to company-level default VAT when creating invoices from orders). The settings page now gracefully handles cases where company settings haven't been created. Several UI enhancements for tables (customers) have been made, and a basic Kanban board for production exists. The build is currently passing and no type errors are reported by `npx tsc --noEmit`.

## 1. Core Entities & Lifecycle

*   **Customer:** Created -> Updated -> Used in Orders/Invoices **[Implemented]**
*   **Inventory Item:** Created -> Stock Adjusted (Purchased/Adjusted) -> Used in Orders -> Stock Decreased (Shipped/Production) **[Basic create/use implemented. Stock adjustment flow refinement, especially for `quantityOnHand` editing and category filtering, are NEXT STEPS.]**
*   **Order:** Draft -> Confirmed (Inventory Allocated) -> Processing (Production Stages via Kanban/Table) -> Shipped/Completed -> INVOICED **[Implemented. Production view needs BOM info display.]**
*   **Invoice:** Draft (From Order/Manual) -> Sent -> Payment Recorded -> Paid / Overdue -> Exported (Finvoice) **[Implemented. Credit Note flow PENDING.]**

## 2. Detailed User Flow: Inventory Item Lifecycle & Sale

**Persona:** Inventory Manager, Sales Rep, Finance Clerk, Admin

**Goal:** Add a new product, manage its stock (including initial quantity and adjustments), sell it, invoice the customer, and export the invoice.

**Steps:**

1.  **Login & Profile Check (Admin/User):** **[Implemented]**
    *   User logs in.
    *   User can update profile (Name, Password). **[Settings page for this is now more robust]**
2.  **Navigate to Inventory:** User selects 'Inventory' from navigation. **[Implemented]**
3.  **Create New Item / Edit Existing Item:**
    *   User clicks 'Add New Item' or selects an item and clicks 'Edit'.
    *   Fills in/Updates `InventoryForm` (SKU, Name, Description, Unit of Measure, VAT-exclusive Cost Price, VAT-exclusive Sales Price, Item Type (`RAW_MATERIAL`/`MANUFACTURED_GOOD`), **Inventory Category**, **`quantityOnHand` (single editable field)**, **`leadTimeDays`**, **`vendorSku`**, **`vendorItemName`** (last two hidden if `MANUFACTURED_GOOD`)). **[SKU handling for order creation is fixed. Other fields PENDING/ENHANCEMENT]**
    *   **NEW/ENHANCE:** User enters/adjusts `quantityOnHand`. For new items, this is initial stock. For existing items, this is a stock adjustment (backend creates an `InventoryTransaction`). This replaces the previous "initial quantity/adjust by X" approach.
    *   Saves the item. **[Backend `inventory.upsert` / `inventory.adjustStock` tRPC mutations. Basic form exists, quantity editing enhancement PENDING.]**
4.  **Manage Stock (Inventory Table - NEW):**
    *   User navigates to the Inventory list.
    *   Table displays `quantityOnHand` as an editable column. Also displays `leadTimeDays` and `InventoryCategory` (as pill tags).
    *   User directly modifies quantity in the table for an item.
    *   System triggers a quick stock adjustment. **[Editable column and mutation PENDING]**
    *   User can filter by **Inventory Category** (pill tags), search by name/SKU, sort, and paginate. **[Advanced table features PENDING]**
5.  **Record Initial Stock / Replenishment (Alternative to Form Edit):** Covered by step 3 & 4. `leadTimeDays` will be used for future replenishment alert features. Manual `InventoryTransaction` creation UI might be a future enhancement if detailed transaction logging (e.g. purchase orders) is needed beyond simple adjustments.
6.  **Create Sales Order:** **[Implemented]**
    *   (Sales Rep) Creates new `Order` (type `WORK_ORDER` or `QUOTATION`).
    *   Selects Customer and adds Inventory Items using **searchable select dropdowns**. Sets quantities.
    *   Saves order as 'Draft'.
    *   **NEW:** User can select multiple orders from the Order list table (via checkboxes) and trigger bulk actions like "Print PDF" (placeholder initially).
7.  **Confirm Order & Allocate Stock:** **[Implemented]**
    *   Order status to 'Confirmed'.
    *   Inventory allocation/deduction logic depends on `itemType` and if it's a `WORK_ORDER` moving to `in_production`.
8.  **Process Order (Production/Fulfillment View for Work Orders):**
    *   (Fulfillment Staff) Views 'Confirmed' `WORK_ORDER`s on Kanban/Table. **[Implemented]**
    *   Updates status (e.g., 'Picking' -> 'Packing' -> 'Ready for Shipment'). **[Manual status update on Kanban implemented]**
    *   **NEW:** Views BOM components and quantities for manufactured items directly on the Kanban card/table row. **[PENDING]**
    *   System Action: When `WORK_ORDER` status -> `in_production`, `MANUFACTURED_GOOD` components are deducted from stock. **[Implemented]**
9.  **Mark Order as Shipped/Completed:** **[Implemented]**
    *   Order status updated to 'shipped'. Ready for invoicing.
10. **Generate Invoice:** **[Implemented]**
    *   (Finance Clerk) Creates Invoice from Order (any status, typically 'Shipped') or manually. Uses **searchable select dropdowns** for Customer/Items if manual.
    *   System pre-populates from order, using `InventoryItem.salesPrice`. VAT is calculated using `InventoryItem.defaultVatRatePercent` if available, otherwise falling back to the company-level default VAT rate from Settings. If neither is set, VAT defaults to 0%. **[VAT logic Implemented]**
    *   Profit calculation occurs in backend. **[Implemented]**
    *   Saves invoice (status 'Draft'). Order status becomes `INVOICED`. **[Implemented]**
    *   **NEW:** User can select multiple invoices from the Invoice list table (via checkboxes) and trigger bulk actions like "Print PDF" (placeholder initially).
11. **Send Invoice:** **[Implemented]**
    *   Status to 'Sent'.
12. **Export Finvoice:** **[Implemented, needs full settings integration]**
    *   Generates Finvoice XML.
13. **Record Payment:** **[Implemented, UI review needed]**
    *   Status to 'Paid'.

## 3. Backend Interaction Focus

- **Data Validation:** Zod schemas for all tRPC inputs. **[Standard Practice]**
- **Database Operations:** Prisma client. **[Standard Practice]**
- **State Updates & UI Revalidation:** tRPC returns updated data; React Query handles cache invalidation and UI updates. **[Standard Practice]**
- **Error Handling:** `TRPCError` for backend errors, toasts for frontend. **[Standard Practice]**

## 4. Other Key Flows (Summary & Next Steps)

*   **Customer Creation & Management:** **[Implemented, with advanced table and edit dialog]**
    *   **NEW:** From the Customer list, user can click a dropdown on a customer row to quickly: Create Invoice, Create Quotation, Create Work Order (pre-fills customer), or Edit Customer.
*   **Customer Order/Invoice History & Revenue Summary (NEW):**
    *   Navigate to Customer Detail Page.
    *   View lists of Orders and Invoices. **[UI PENDING, Backend tRPC ready]**
    *   View Total Net Revenue. **[Calculation and UI PENDING]**
*   **BOM Creation & Management:**
    *   Navigate to `MANUFACTURED_GOOD` Inventory Item detail page.
    *   **NEXT:** UI form to create/edit BOMs (add `RAW_MATERIAL` components, quantities, set `manualLaborCost`). Backend `bomRouter.upsert` exists.
*   **Inventory Category Management (Implicit):** Categories are created/managed via Prisma Studio or migrations for now. Future: UI for category CRUD if needed.

**Next Steps (User Flow Focused):**
1.  **Inventory Management Enhancements:**
    *   Implement UI for editing `quantityOnHand` (single field) during Inventory Item creation and edit (via `InventoryItemForm`).
    *   Add `leadTimeDays`, `vendorSku`, `vendorItemName` fields to `InventoryItemForm` (conditional visibility for vendor fields).
    *   Develop the editable `quantityOnHand` column in the Inventory list table with quick adjustment functionality.
    *   Add Inventory Category column (with pill tags) and filtering to the Inventory list. Display `leadTimeDays`.
    *   Implement advanced table features (search, sort, filter, pagination) for the Inventory list.
2.  **Order & Invoice Flow Enhancements:**
    *   Implement searchable select dropdowns for Customer and Item selection in Order/Invoice forms.
    *   Add multi-select checkboxes and bulk action capabilities (e.g., "Print PDF" placeholder) to Order and Invoice list tables.
3.  **Customer Management Enhancements:**
    *   Implement the customer action dropdown (Create Invoice/Quotation/Work Order, Edit) on the Customer list table.
    *   Develop the UI on the Customer Detail Page to display order history, invoice history, and total net revenue.
4.  **Production Kanban/Table Enhancements:**
    *   Design and implement the BOM information view within Kanban cards/table rows for manufactured items in an order.
5.  **BOM Management UI:**
    *   Create the frontend forms and views for managing Bill of Materials linked to `MANUFACTURED_GOOD` items.
6.  **Refine Payment Recording:** Review and potentially enhance the UI for recording invoice payments.
7.  **Credit Note Flow:** Implement the full user flow for creating and managing credit notes from existing invoices.
8.  **Dashboard & Reporting Flows:** Define and implement user flows for accessing and interacting with dashboard metrics and reports.
9.  **Build Health & Stability:** Maintain a clean build (`npm run build`) and TypeScript checks (`npx tsc --noEmit`) throughout development. **[Currently Stable]**
10. **PDF Generation Access:** Ensure users can easily trigger and download PDF versions of Invoices, Orders, Pricelists, etc.
