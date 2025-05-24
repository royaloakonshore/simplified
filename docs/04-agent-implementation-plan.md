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

**Phase 1: Foundation & Core Modules (Partially Complete)**

1.  **Setup & Config:** Project init, dependencies, DB connection, env vars. (DONE)
2.  **Authentication:** NextAuth setup (Email/Credentials), Prisma Adapter, Sign-in page, Settings page (Password/Profile). (DONE - Email provider temporarily disabled)
3.  **Core Layout:** Main app layout, Shadcn Sidebar navigation. (DONE)
4.  **Customer Module:** Schema, tRPC router (CRUD), List/Detail/Form components. (DONE)
5.  **Inventory Module (Basic):** Schema (Item, Transaction), tRPC router (CRUD for Item, AdjustStock), List/Detail/Form components. (DONE)
6.  **Order Module (Initial):** Schema, tRPC router (CRUD), List/Detail/Form components. (DONE - Basic form implemented, needs Quote/Work Order logic)
7.  **Invoice Module (Initial):** Schema, tRPC router (List, Get, Create), List/Detail/Form components. (DONE - Basic form implemented)
8.  **Production Module (Basic):** Schema stubs (if any), Kanban view component (basic), link from Orders. (DONE - Basic Kanban implemented)

**Phase 2: BOM, Inventory, Order/Invoice Workflow Enhancements & Initial Multi-Tenancy Refinement

**Status:** In Progress (Schema adjustments for BOM/Inventory/Production completed, Profitability/Customer History features planned)

**Core Objectives:** Implement Bill of Materials, refine inventory item properties, streamline order-to-invoice workflow, and begin integrating robust multi-tenancy context. Introduce profitability tracking and enhanced customer views.

**Key Tasks & Features:**

1.  **Bill of Materials (BOM) Creation & Editing:**
    *   **Schema:** `BillOfMaterial` and `BillOfMaterialItem` Prisma schemas defined and migrated. `InventoryItem.itemType` (`RAW_MATERIAL`/`MANUFACTURED_GOOD`) dictates BOM applicability.
    *   **Backend (tRPC `bom.ts`):** Implement full CRUD operations for `BillOfMaterial` and `BillOfMaterialItem`.
        *   **Crucial:** When a `BillOfMaterial` is created or updated (components, quantities, `manualLaborCost` changed), the `totalCalculatedCost` (VAT-exclusive) on the `BillOfMaterial` model **must** be recalculated and saved. This involves summing (component `InventoryItem.costPrice` \* quantity) for all items, plus `manualLaborCost`.
    *   **UI:** Develop UI for BOM creation, viewing, and editing: linking component `InventoryItem`s (must be `RAW_MATERIAL`) to a parent `MANUFACTURED_GOOD` `InventoryItem`, specifying quantities, and `manualLaborCost` (VAT-exclusive).

2.  **Inventory Item Enhancements & Refinement:**
    *   **Item Type (`itemType`):** The `InventoryItem.itemType` field is now the sole determinant for `RAW_MATERIAL` vs. `MANUFACTURED_GOOD`. The old `materialType` field has been removed. All related logic and UI must be updated to use `itemType`.
        *   Forms for item creation/editing must clearly present `itemType` selection.
        *   Ensure all costs/prices (`costPrice`, `salesPrice`) entered are explicitly stated and handled as **VAT-exclusive**.
    *   **Quantity:** `InventoryItem.quantityOnHand` meaning is consistent for both types (physical stock).

3.  **Price List Functionality:** (No direct changes from recent schema updates, but ensure it correctly sources `salesPrice` which is VAT-exclusive).

4.  **Order/Invoice Creation Workflow & Production Trigger:**
    *   **Invoice Totals:** Ensure `invoiceRouter.create` and `invoiceRouter.createFromOrder` correctly calculate and save `Invoice.totalAmount` as the **NET (VAT-exclusive) total**, and `Invoice.totalVatAmount` as the sum of line VATs. User-facing totals will be `totalAmount + totalVatAmount`.
    *   **Production Trigger:** The logic in `orderRouter` (or relevant server action) that handles `Order.status` changes to `in_production` (for `orderType = WORK_ORDER`) must:
        *   Identify `MANUFACTURED_GOOD` items in the order (via `InventoryItem.itemType`).
        *   For each, fetch its `BillOfMaterial`.
        *   Deduct the required quantities of component `InventoryItem`s (raw materials) from `InventoryItem.quantityOnHand` by creating appropriate `InventoryTransaction` records.

5.  **Order Detail Page - PDF Export/Print:** (Existing task, ensure it uses net prices and calculates VAT correctly for display).

6.  **Finvoice Seller Details Integration:** (Existing task, no direct impact from these schema changes, but ensure data like company name, VAT ID etc. is sourced correctly for the now VAT-exclusive system).

7.  **NEW - Profitability Tracking Implementation:**
    *   **Backend Logic (`invoiceRouter` create/update operations):**
        *   When creating/updating `InvoiceItem` records:
            *   Fetch the linked `InventoryItem`.
            *   Calculate `calculatedUnitCost` (VAT-exclusive): 
                *   If `RAW_MATERIAL`: `InventoryItem.costPrice`.
                *   If `MANUFACTURED_GOOD`: `InventoryItem.bom.totalCalculatedCost`.
            *   Calculate `calculatedUnitProfit` (VAT-exclusive): `InvoiceItem.unitPrice` (net, after discounts) - `calculatedUnitCost`.
            *   Calculate `calculatedLineProfit` (VAT-exclusive): `calculatedUnitProfit` * `InvoiceItem.quantity`.
            *   Store these three new fields in the `InvoiceItem` record.
    *   **Dashboard Integration:**
        *   Develop tRPC procedures to fetch and aggregate `InvoiceItem.calculatedLineProfit` for dashboard display (e.g., total profit, profit by product/customer over time).
        *   Implement UI widgets on the main dashboard.

8.  **NEW - Customer Order/Invoice History & Revenue Summary:**
    *   **Backend (tRPC `customer.ts`):**
        *   Create or enhance a procedure (e.g., `customer.getWithHistory`) to fetch a specific `Customer` along with their `Order[]` and `Invoice[]` relations.
        *   Ensure orders and invoices are sufficiently populated with key details (number, date, status, net totals, VAT, gross totals for invoices).
    *   **Frontend (`app/(erp)/customers/[id]/page.tsx`):**
        *   Develop the customer detail page UI.
        *   Display customer information.
        *   Display sortable/filterable tables for Order History and Invoice History.
        *   Calculate and display "Total Net Revenue from Customer" (sum of `Invoice.totalAmount` for relevant invoices).

**Multi-Tenancy Context (`companyId`):**
*   The `companyId` field (currently optional) has been added to core models (`InventoryItem`, `BillOfMaterial`, `BillOfMaterialItem`, `Supplier`, `InventoryCategory`, `Invoice`, `Order`, `Customer`, etc.).
*   **Future Task:** Plan and execute data backfill for `companyId` on existing records. Then, make `companyId` non-nullable on these models and update tRPC procedures to enforce company-scoped data access via `ctx.companyId` (using `companyProtectedProcedure` where appropriate).

**Phase 3: Refinement & Advanced Features**

18. **Resolve Known Issues:** Fix `nodemailer` build error, re-enable Email provider. Fix `firstName` type errors (now resolved for profile update). Address `InventoryItemForm.tsx` type issues (workaround with `any` applied).
19. **Robust Invoice Numbering:** Implement DB sequence or locking.
20. **Performance Optimization:** Add DB indexes, review query efficiency, implement caching/prefetching as needed.
21. **Testing:** Add unit/integration tests for critical logic (calculations, inventory updates, Finvoice mapping).
22. **Multi-Tenancy:** Implement fully scoped data access using `companyId` and `companyProtectedProcedure`.
23. **Advanced Reporting:** Implement more detailed reports.
24. **UI/UX Polish:** Refine layouts, improve error handling displays, add confirmations.

**Step 6: Settings & Finalization**
    *   **Goal:** Implement basic settings and finalize the application.
    *   **Tasks:**
        *   Create a Settings page (`src/app/(erp)/settings/page.tsx`).
        *   Implement a form (`SettingsForm`) to capture and save **Seller Party details** required for Finvoice headers (Company Name, VAT ID, OVT, Bank Account IBAN/BIC, Intermediator details). Store these securely (e.g., in a dedicated `settings` table or potentially user/profile metadata if appropriate).
        *   Ensure the `finvoice.service` reads these settings when generating XML.
        *   Create a simple Dashboard overview page (`src/app/(erp)/dashboard/page.tsx`) showing key metrics (optional).
        *   Implement Admin User Management UI within the Settings page or a dedicated Admin section:
            *   List existing users (from Prisma `User` model).
            *   Form/modal to invite/create new users (handle password setup securely, e.g., invite link or temporary password).
            *   Ability for Admin to update user roles (`UserRole` enum in Prisma).
            *   Ability to activate/deactivate users.
            *   Implement corresponding tRPC procedures (mutations) for these admin actions, ensuring proper authorization checks (only Admins can perform).
        *   Conduct comprehensive testing (review unit/integration tests, consider manual E2E flows for critical paths like order-to-invoice-to-finvoice).
        *   Perform UI polishing, ensure responsiveness and adherence to the monochrome theme.
        *   Update project README with setup, usage, and deployment instructions.
        *   Prepare for deployment (configure environment variables for production Supabase, check Vercel build settings).

**Step 7: UI Polish & Shadcn Blocks Integration (Lower Priority)**
    *   **Goal:** Enhance the overall UI/UX using Shadcn Blocks and common patterns.
    *   **Tasks:**
        *   Integrate Shadcn Sidebar 07 (`npx shadcn add sidebar-07`) for the main application navigation as specified in initial requirements, replacing any existing sidebar from the starter template.
        *   Implement Shadcn Breadcrumbs (`npx shadcn add breadcrumb`) consistently across pages for navigation context.
        *   Review and refactor existing Tables, Forms, Pagination controls, and other core UI elements to align better with styles and examples found in Shadcn Blocks (e.g., improve density, layout, consistency).
        *   Ensure consistent application of the monochrome theme throughout.

--- --- ---

**Agent Starting Point:** Begin with **Step 1: Verify & Adapt Starter Template** after User completes Phase 0. (Current state: Completed Step 1, Started Step 2 - Customer List implemented). Next logical step is completing Step 2 (Add/Edit Customer Form/Pages).
