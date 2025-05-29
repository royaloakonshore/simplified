# Agent Implementation Plan - Simplified ERP System

This plan outlines the step-by-step implementation process for the AI agent building the ERP system. Each major step represents a logical unit of work.

**Core Principle:** Build foundational elements first, then layer features module by module. Prioritize backend (types, schemas, actions, DB interactions) before frontend UI implementation within each module.

**Current Context & Progress:**
The project has a stable build. Phase 1 (Foundation & Core Modules) is largely complete. This includes authentication, core layout, and basic CRUD functionalities for Customers, Inventory (Items & Transactions), Orders (Quotes/Work Orders), Invoices (including profitability calculation backend), and a simplified Production Kanban view. The backend for Bill of Materials (BOM) is also implemented. Recent work focused on resolving numerous build/type errors and ensuring `InventoryItem.defaultVatRatePercent` is used in invoice creation. The project now passes `npm run build`, and `npx tsc --noEmit` reveals only two minor 'implicit any' type errors in `src/lib/api/routers/invoice.ts`.

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

1.  **Resolve Remaining Type Errors & Implement VAT Fallback:**
    *   **Fix `invoice.ts`:** Address the two 'implicit any' type errors for parameters in the `createFromOrder` and `update` procedures in `src/lib/api/routers/invoice.ts`.
    *   **Company Default VAT:** Implement logic in `invoiceRouter.createFromOrder` (and potentially other relevant tRPC procedures like `invoice.update`) to use a company-level default VAT rate if `InventoryItem.defaultVatRatePercent` is not defined. This will likely involve fetching a company setting (TODO: define where this setting is stored and how it's accessed, e.g., `Company.defaultVatRate` or a dedicated `Settings` model).

2.  **Inventory Module Enhancements (NEW REQUIREMENTS):**
    *   **Editable `quantityOnHand` in Forms:**
        *   Modify `InventoryItemForm.tsx` to allow setting/editing `quantityOnHand`.
        *   During creation, this sets the initial stock (creates an `InventoryTransaction`).
        *   During edit, this triggers a stock adjustment (creates an `InventoryTransaction`).
        *   Update `inventory.upsert` or add new tRPC mutation if needed to handle this logic cleanly.
    *   **Editable `quantityOnHand` in Inventory Table:**
        *   Modify the Inventory list table (`src/app/(erp)/inventory/page.tsx` and related components) to display `quantityOnHand` as an inline-editable column.
        *   Implement a new tRPC mutation for quick, direct stock adjustment from this table cell.
    *   **Product Category in Table & Filtering:**
        *   Add `InventoryCategory.name` as a column in the Inventory list table.
        *   Implement filtering by `InventoryCategory` using `DataTableFacetedFilter` or similar.
    *   **Advanced Inventory Table Features:**
        *   Add a search bar to the Inventory list table.
        *   Implement robust client-side or server-side filtering (beyond category), sorting, and pagination for the Inventory list table, similar to `CustomerTable`.

3.  **Production Kanban/Table - BOM Information View (NEW REQUIREMENT):**
    *   **UI:** In the Production Kanban view (`src/app/(erp)/production/page.tsx`), for orders containing `MANUFACTURED_GOOD` items, implement a way to view BOM information directly on the Kanban card or in an associated modal/expandable section.
    *   This view should list component `InventoryItem`s and their required quantities for each manufactured item in the order.
    *   Fetch necessary BOM data via existing tRPC procedures if possible, or create new ones.

4.  **Bill of Materials (BOM) - UI Implementation:** **[PENDING]**
    *   **UI:** Develop UI for BOM creation, viewing, and editing. This includes forms to add/remove `BillOfMaterialItem`s, input for `manualLaborCost`, display of `totalCalculatedCost`, and linking to/from `InventoryItem` (type `MANUFACTURED_GOOD`). Calls existing `bomRouter`.

5.  **Customer Order/Invoice History & Revenue Summary - UI Implementation:** **[PENDING]**
    *   **Frontend (`app/(erp)/customers/[id]/page.tsx`):** Develop UI sections for Order/Invoice History (tables) and display Total Net Revenue from Customer, using existing tRPC procedures.

6.  **Dashboard & Reporting - Initial Implementation:** **[PENDING]**
    *   **Dashboard:** Populate the existing dashboard page (`src/app/(erp)/dashboard/page.tsx`) with initial key metrics (e.g., overdue invoices, orders to ship, low stock items - tRPC procedures needed).
    *   **Profitability:** Display basic profitability insights (e.g., total profit) using aggregated `InvoiceItem.calculatedLineProfit` data (tRPC procedures needed).

7.  **PDF Generation:** **[PENDING]**
    *   Implement server-side PDF generation for Invoices, Orders, Pricelists, and Credit Notes. Define tRPC endpoints to trigger generation and download.

8.  **Finvoice Seller Details Integration:** **[PENDING]**
    *   Fully integrate Company Settings from DB into `finvoice.service.ts`, replacing any placeholders.

9.  **Credit Note Flow - UI & Full Workflow:** **[PENDING]**
    *   Implement UI for creating credit notes from existing invoices, and managing their lifecycle.

10. **Stock Alerts Display:** **[PENDING]**
    *   Implement UI to show stock alerts (low stock based on min/reorder levels, negative stock) on the dashboard or relevant item pages.

11. **Testing & Refinement:** Continuously test implemented features and refine UI/UX.

12. **Build Health & TypeScript Hygiene:** Maintain a passing `npm run build` and a clean `npx tsc --noEmit` report throughout the development process. Address any new errors promptly.

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
