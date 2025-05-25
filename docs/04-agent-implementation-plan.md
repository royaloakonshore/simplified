# Agent Implementation Plan - Simplified ERP System

This plan outlines the step-by-step implementation process for the AI agent building the ERP system. Each major step represents a logical unit of work, potentially suitable for a separate development session/chat context.

**Core Principle:** Build foundational elements first, then layer features module by module. Prioritize backend (types, schemas, actions, DB interactions) before frontend UI implementation within each module.

**Testing:** Tests (unit, integration) should be written alongside or immediately after implementing the corresponding functionality for each step.

--- --- ---

**Phase 0: Preparation (USER)**

*   User sets up a new project directory.
*   User initializes the project using a suitable starter template (e.g., `next-ai-starter` or similar recommended Next.js/Supabase/Shadcn template).
*   User installs all base dependencies (`npm install` or equivalent).
*   User configures `.env.local` with Supabase URL and Anon Key.
*   User copies the updated documentation files (from the `docs/project-overview/` directory generated in the previous session) into the new project's `docs/` folder.

**Phase 1: Foundation & Core Modules (Largely Complete)**

1.  **Setup & Config:** (DONE)
2.  **Authentication:** NextAuth (Email/Credentials), Prisma Adapter, Sign-in, Settings (Profile/Password). (DONE - Email provider temporarily disabled due to build issues).
3.  **Core Layout:** Main app layout, Shadcn Sidebar. (DONE)
4.  **Customer Module:** Schema, tRPC (CRUD), List/Detail/Form. (DONE)
5.  **Inventory Module:** Schema (Item, Transaction, ItemType), tRPC (CRUD for Item, AdjustStock), List/Detail/Form. (DONE - `itemType` implemented, `materialType` removed).
6.  **Order Module:** Schema, tRPC (CRUD), List/Detail/Form. (DONE - Quote/Work Order logic in place).
7.  **Invoice Module:** Schema (incl. profitability fields), tRPC (List, Get, Create, Update), List/Detail/Form. `totalAmount` confirmed NET. Profitability calculation logic in tRPC DONE. (DONE)
8.  **Production Module (Simplified):** Kanban view, driven by Order status. (DONE)
9.  **Bill of Materials (BOM) Backend:** Schema (`BillOfMaterial`, `BillOfMaterialItem`), tRPC router (`bom.ts` for CRUD & `totalCalculatedCost` calculation). (DONE)

**Phase 2: UI Implementation for Backend Features & Enhancements**

**Status:** In Progress

**Core Objectives:** Implement UIs for BOM management, Customer History, and Profitability. Address placeholder VAT rate in invoice creation from order. Continue refining UI/UX across modules.

**Key Tasks & Features (Prioritized Next Steps):**

1.  **Invoice Creation from Order - VAT Rate:**
    *   **Task:** Modify `invoiceRouter.createFromOrder` to use the actual `defaultVatRatePercent` from `InventoryItem` for each line item, instead of the placeholder `25.5`.
    *   **Consideration:** Add a company-level default VAT rate in Settings as a fallback if `InventoryItem.defaultVatRatePercent` is null.

2.  **Bill of Materials (BOM) - UI Implementation:** **[PENDING]**
    *   **UI:** Develop UI for BOM creation, viewing, and editing on the frontend. This includes:
        *   A way to navigate to/from an `InventoryItem` (type `MANUFACTURED_GOOD`) to its BOM(s).
        *   Forms to add/remove `BillOfMaterialItem`s (linking `RAW_MATERIAL` `InventoryItem`s as components).
        *   Input for `manualLaborCost` (VAT-exclusive).
        *   Display of the system-calculated `totalCalculatedCost`.
        *   Calls to the existing `bomRouter` tRPC procedures.

3.  **Customer Order/Invoice History & Revenue Summary - UI Implementation:** **[PENDING]**
    *   **Frontend (`app/(erp)/customers/[id]/page.tsx`):**
        *   Develop the customer detail page UI sections for Order History and Invoice History using the existing tRPC procedures.
        *   Implement tables (sortable/filterable) for displaying these histories.
        *   Calculate and display "Total Net Revenue from Customer" (sum of `Invoice.totalAmount` for relevant invoices, VAT-exclusive).

4.  **Profitability Tracking - Dashboard/Reporting UI:** **[PENDING]**
    *   **Dashboard Integration:**
        *   Develop tRPC procedures to fetch and aggregate `InvoiceItem.calculatedLineProfit` for dashboard display (e.g., total profit, profit by product/customer over time).
        *   Implement UI widgets/charts on the main dashboard to visualize this data.

5.  **Outstanding UI/UX & Minor Fixes:**
    *   **Order Detail Page - PDF Export/Print:** Implement. **[PENDING]**
    *   **Inventory - Pricelist PDF Export:** Implement. **[PENDING]**
    *   **Invoice - PDF Export:** Implement. **[PENDING]**
    *   **Finvoice Seller Details Integration:** Fully integrate Company Settings from DB into `finvoice.service.ts`. **[PENDING]**
    *   **Stock Alerts Display:** Implement UI to show stock alerts. **[PENDING]**
    *   **Nodemailer Build Issue:** Investigate and resolve the `nodemailer` build error to re-enable the NextAuth EmailProvider. **[PENDING]**
    *   **Order Status Update Modal Dropdown:** Verify if z-index change fixed it. If not, further investigate. **[Testing Pending]**

**Multi-Tenancy Context (`companyId`):**
*   The `companyId` field is present but optional on core models.
*   **Future Task:** Plan and execute data backfill for `companyId`. Then, make `companyId` non-nullable and update tRPC procedures to enforce company-scoped data access (e.g., using `companyProtectedProcedure`).

**Phase 3: Refinement & Advanced Features (Later Focus)**

*   **Robust Invoice Numbering:** Implement DB sequence or locking for enterprise-grade sequential numbering if current logic proves insufficient under high concurrency (current logic is generally fine for small businesses).
*   **Performance Optimization:** Add DB indexes as needed, review query efficiency, implement caching/prefetching if performance issues arise.
*   **Testing:** Expand unit/integration tests for critical logic.
*   **Multi-Tenancy Enforcement:** Implement fully scoped data access using `companyId`.
*   **Advanced Reporting:** Develop more detailed and customizable reports.
*   **UI/UX Polish:** General refinements, confirmations, advanced filtering/sorting etc.
*   **Admin User Management UI:** (From old Step 6) List users, invite/create, update roles, activate/deactivate. This is a significant feature for later.

**Removed Sections (Previously Step 6 & 7, and old Agent Starting Point):** The old detailed Step 6 (Settings & Finalization) and Step 7 (UI Polish & Shadcn Blocks) have been broken down and their relevant pending items (like Admin User Management, PDF generation, Finvoice settings integration, specific Shadcn block integrations) are now incorporated into the prioritized task list or noted as future/later focus items. The initial "Agent Starting Point" is no longer relevant.
