# Agent Implementation Plan - Simplified ERP System

This plan outlines the step-by-step implementation process for the AI agent building the ERP system. Each major step represents a logical unit of work.

**Core Principle:** Build foundational elements first, then layer features module by module. Prioritize backend (types, schemas, actions, DB interactions) before frontend UI implementation within each module.

**Current Context & Progress:**
The project has a stable build. Phase 1 (Foundation & Core Modules) is largely complete. This includes authentication, core layout, and basic CRUD functionalities for Customers, Inventory (Items & Transactions), Orders (Quotes/Work Orders), Invoices (including profitability calculation backend), and a simplified Production Kanban view. The backend for Bill of Materials (BOM) is also implemented. Recent work focused on resolving numerous build/type errors. `InventoryItem.defaultVatRatePercent` is now used in invoice creation, with a fallback to company-level settings. The `settings.get` tRPC procedure correctly handles missing settings, and SKU handling in orders is fixed. The project now passes `npm run build`, and `npx tsc --noEmit` reveals no errors. All previously noted type errors in `src/lib/api/routers/invoice.ts` are resolved.

--- --- ---

**Phase 0: Preparation (USER)**

*   Completed.

**Phase 1: Foundation & Core Modules (Largely Complete)**

1.  **Setup & Config:** (DONE)
2.  **Authentication:** NextAuth (Email/Credentials), Prisma Adapter, Sign-in, Settings (Profile/Password). (DONE - Email provider re-enabled after date-picker fixes).
3.  **Core Layout:** Main app layout, Shadcn Sidebar. (DONE)
4.  **Customer Module:** Schema, tRPC (CRUD), List/Detail/Form, Advanced Table, Edit Dialog. (DONE)
5.  **Inventory Module:** Schema (Item, Transaction, ItemType, Category), tRPC (CRUD for Item, AdjustStock), Basic List/Detail/Form. (DONE - `itemType` implemented, `defaultVatRatePercent` added).
6.  **Order Module:** Schema, tRPC (CRUD), List/Detail/Form. (DONE - Quote/Work Order logic in place).
7.  **Invoice Module:** Schema (incl. profitability fields), tRPC (List, Get, Create, Update, `createFromOrder` using item VAT), List/Detail/Form. (DONE)
8.  **Production Module (Simplified):** Kanban view, driven by Order status. Inventory deduction for BOM components on `in_production` status. (DONE)
9.  **Bill of Materials (BOM) Backend:** Schema (`BillOfMaterial`, `BillOfMaterialItem`), tRPC router (`bom.ts` for CRUD & `totalCalculatedCost` calculation). (DONE)

**Phase 2: UI Implementation, Module Enhancements & New Features**

**Status:** In Progress

**Core Objectives:** Enhance Inventory module with requested features, implement UI for BOMs and Customer History, develop Dashboard and Reporting, and complete PDF generation and Finvoice integration.

**Key Tasks & Features (Prioritized Next Steps):**

1.  **Inventory Module Enhancements (NEW REQUIREMENTS):**
    *   **Single, Editable `quantityOnHand` Field:**
        *   Modify `InventoryItemForm.tsx` to use a single, directly editable `quantityOnHand` field. This replaces the previous "initial quantity/adjust by X" approach.
        *   Ensure this field updates `InventoryTransaction` records appropriately on create/edit.
    *   **Additional Inventory Item Fields:**
        *   Add `leadTimeDays` (number field) to `InventoryItemForm.tsx` and relevant table display.
        *   Add `vendorSku` and `vendorItemName` fields to `InventoryItemForm.tsx`, hidden if `itemType` is `MANUFACTURED_GOOD`.
    *   **Editable `quantityOnHand` in Inventory Table:**
        *   Modify the Inventory list table to display `quantityOnHand` as an inline-editable column.
        *   Implement a tRPC mutation for quick, direct stock adjustment from this table cell.
    *   **Product Category in Table & Filtering:**
        *   Add `InventoryCategory.name` as a column (with pill tags) in the Inventory list table.
        *   Implement filtering by `InventoryCategory`.
    *   **Advanced Inventory Table Features:**
        *   Add a search bar to the Inventory list table.
        *   Implement robust filtering, sorting, and pagination.

2.  **Customer Module Enhancements (NEW REQUIREMENTS):**
    *   **Customer Table Action Dropdown:**
        *   Change the "Edit" button on customer rows in `CustomerTable` to a dropdown menu with icons.
        *   Options: "Create Invoice", "Create Quotation", "Create Work Order", "Edit Customer".
        *   Ensure actions prefill customer data when navigating.
    *   **Customer Order/Invoice History & Revenue Summary - UI Implementation:**
        *   Frontend (`app/(erp)/customers/[id]/page.tsx`): Develop UI sections for Order/Invoice History (tables) and display Total Net Revenue from Customer.

3.  **Order & Invoice Module Enhancements (NEW REQUIREMENTS):**
    *   **Searchable Select Dropdowns:**
        *   Implement searchable select components (e.g., using popover with search) for Item and Customer selection in Order and Invoice creation/editing forms.
    *   **Table Multi-Select & Bulk Actions:**
        *   Add multi-select checkboxes to Order and Invoice list tables.
        *   Implement bulk action options (e.g., "Print PDF" - can be a placeholder initially).

4.  **Production Kanban/Table - BOM Information View (NEW REQUIREMENT):**
    *   **UI:** In the Production Kanban view, for orders with `MANUFACTURED_GOOD` items, implement a BOM information view (e.g., modal/expandable section on card/row).
    *   List component `InventoryItem`s and quantities.

5.  **Bill of Materials (BOM) - UI Implementation:** **[PENDING]**
    *   **UI:** Develop UI for BOM CRUD, including `manualLaborCost` input and `totalCalculatedCost` display.

6.  **Dashboard & Reporting - Initial Implementation:** **[PENDING]**
    *   Populate dashboard with key metrics and basic profitability insights.

7.  **PDF Generation:** **[PENDING]**
    *   Implement server-side PDF generation for Invoices, Orders, Pricelists, Credit Notes.

8.  **Finvoice Seller Details Integration:** **[PENDING]**
    *   Integrate Company Settings into `finvoice.service.ts`.

9.  **Credit Note Flow - UI & Full Workflow:** **[PENDING]**
    *   Implement UI for Credit Note creation and management.

10. **Stock Alerts Display:** **[PENDING]**
    *   Implement UI for stock alerts.

11. **Testing & Refinement:** Continuously test implemented features and refine UI/UX.

12. **Build Health & TypeScript Hygiene:** Maintain a passing `npm run build` and a clean `npx tsc --noEmit` report. Address any new errors promptly. **[Currently Stable]**

**Multi-Tenancy Context (`companyId`):**
*   `companyId` is present but optional on core models. Future task: Make non-nullable and enforce company-scoped data access via tRPC.

**Phase 3: Advanced Features & Polish (Later Focus)**

*   Robust sequential numbering for invoices/orders.
*   Performance optimization (DB indexing, query review).
*   Expanded test coverage.
*   Full multi-tenancy enforcement.
*   Advanced, customizable reporting.
*   Comprehensive UI/UX polish.
*   Admin User Management UI.
