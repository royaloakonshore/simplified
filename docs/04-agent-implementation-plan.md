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

**Phase 2: Feature Enhancement & Integration (Current Focus)**

9.  **Order Module - Quote/Work Order:** ✅ COMPLETED
    *   Add `orderType` enum and field to `Order` schema.
    *   Update `OrderForm` with conditional logic/UI for Quote vs. Work Order.
    *   Update `OrderListContent` to show `orderType`.
    *   Refine Order statuses if needed based on type.
10. **Order/Invoice Line Item Enhancements:** ✅ PARTIALLY COMPLETED (Invoice VAT & Order Status update)
    *   Add `discountAmount`, `discountPercentage` to `OrderItem`/`InvoiceItem` schemas. (Done for InvoiceItem & OrderItem in schema, UI/logic pending for OrderItem)
    *   Add `vatReverseCharge` flag to `Invoice` schema. (Done)
    *   Update `OrderForm`/`InvoiceForm` item tables with discount fields. (Partially for InvoiceForm, pending for OrderForm)
    *   Add VAT dropdown (Finnish levels) to `InvoiceForm` items. (Done, default 24% - corrected)
    *   Add VAT Reverse Charge checkbox to `InvoiceForm`. (Done)
    *   Update backend total calculations for discounts. (Done for Invoice, pending for Order)
    *   Update backend invoice creation to handle `vatReverseCharge` (set VAT to 0). (Done)
    *   **New:** Order status updated to `INVOICED` upon invoice creation from order. (Done)
    *   **New:** Default VAT rate for invoices now 24%. (Corrected)
    *   **New:** User Profile Update (`firstName` handling) and Order Creation (`userId` foreign key constraint) issues resolved. **[Critical Fixes Implemented]**
    *   **TODO:** Implement date-aware VAT logic for invoices.
11. **BOM Module:** 🔜 PLANNED NEXT
    *   Define `BillOfMaterial` and `BillOfMaterialItem` schemas.
    *   Create tRPC router (`bom.ts`) with CRUD procedures.
    *   Implement BOM Create/Edit form UI.
    *   Implement backend BOM cost calculation logic.
12. **Inventory - Pricelist & Stock Alerts:** 🔜 PLANNED
    *   Add `showInPricelist` field to `InventoryItem` schema.
    *   Update Inventory list UI with "Show Pricelist" button and filtering logic.
    *   Implement tRPC query for pricelist data.
    *   Add "Add to Pricelist" checkbox to Inventory item form.
    *   Implement negative stock alert detection logic (querying transactions).
    *   Add Stock Alert display UI (e.g., table in Inventory page, Dashboard widget).
    *   Implement recurring Toast notifications for active alerts.
13. **Inventory Deduction for Production:** 🔜 PLANNED
    *   Modify `order.updateStatus` tRPC mutation to create negative `InventoryTransaction` records based on BOMs when status changes to `in_production`.
    *   Handle negative stock case by generating alert, not failing transaction.
14. **Finvoice Enhancements:**
    *   Update `finvoice.service.ts` to map discounts correctly.
    *   Update `finvoice.service.ts` to handle `vatReverseCharge` flag (set VAT to 0, add exemption reason code/text).
15. **PDF Generation (Invoice & Pricelist):**
    *   Choose/set up server-side PDF generation library (e.g., Puppeteer).
    *   Create API routes or Inngest functions triggered by tRPC mutations.
    *   Develop basic PDF templates.
16. **Production View Simplification:**
    *   Update Production module tRPC queries to exclude pricing fields.
    *   Ensure Production UI does not display prices.
17. **Item Selection Dropdown:**
    *   Update item selection in `OrderForm`/`InvoiceForm` to use a searchable Combobox.
    *   Implement tRPC query (`inventory.getSelectableItems`) filtering by `showInPricelist`.

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
