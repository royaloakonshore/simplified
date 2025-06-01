# Agent Implementation Plan - Simplified ERP System

This plan outlines the step-by-step implementation process for the AI agent building the ERP system. Each major step represents a logical unit of work.

**Core Principle:** Build foundational elements first, then layer features module by module. Prioritize backend (types, schemas, actions, DB interactions) before frontend UI implementation within each module.

**Current Context & Progress:**
The project has a stable build. Phase 1 (Foundation & Core Modules) is largely complete. This includes authentication, core layout, and basic CRUD functionalities for Customers, Inventory (Items & Transactions), Orders (Quotes/Work Orders), Invoices (including profitability calculation backend), and a simplified Production Kanban view. The backend for Bill of Materials (BOM) is also implemented. Recent work focused on resolving numerous build/type errors, including in the inventory tRPC router. `InventoryItem.defaultVatRatePercent` is now used in invoice creation, with a fallback to company-level settings. The `settings.get` tRPC procedure correctly handles missing settings, and SKU handling in orders is fixed. The project now passes `npm run build`, and `npx tsc --noEmit` reveals no errors. All previously noted type errors in `src/lib/api/routers/invoice.ts` are resolved.

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
        *   Modify `InventoryItemForm.tsx` to use a single, directly editable `quantityOnHand` field. This replaces the previous "initial quantity/adjust by X" approach. **[DONE]**
        *   Ensure this field updates `InventoryTransaction` records appropriately on create/edit. **[DONE - Backend logic implemented in `inventory.create` and `inventory.update`]**
    *   **Additional Inventory Item Fields:**
        *   Add `leadTimeDays` (number field) to `InventoryItemForm.tsx` and relevant table display. **[DONE for form. Table display PENDING]**
        *   Add `vendorSku` and `vendorItemName` fields to `InventoryItemForm.tsx`, hidden if `itemType` is `MANUFACTURED_GOOD`. **[DONE for form. Conditional hiding and table display PENDING]**
    *   **Editable `quantityOnHand` in Inventory Table:**
        *   Modify the Inventory list table to display `quantityOnHand` as an inline-editable column. **[PENDING]**
        *   Implement a tRPC mutation for quick, direct stock adjustment from this table cell. **[PENDING]**
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

## Feature: Invoice Actions Refactor

**Goal:** Consolidate invoice actions into a single dropdown menu on detail and list views, add PDF export and Copy Invoice functionality.

**Tasks:**
1.  **Backend - PDF Export:** Define tRPC `invoiceRouter.actions.exportPdf` to generate PDF using Puppeteer.
2.  **Backend - Copy Invoice:** Define tRPC `invoiceRouter.actions.copyInvoice` to duplicate an invoice as a new draft.
3.  **Backend - Update Status Logic:** Ensure `invoiceRouter.actions.updateStatus` (or equivalent) correctly handles payment recording when status is set to `PAID`.
4.  **Frontend - Detail Page (`InvoiceDetail.tsx`):** Remove existing "Update Status" and "Record Payment" buttons. Implement a single "Actions" dropdown menu containing all status transitions, "Create Credit Note", "Export Finvoice", "Export PDF", and "Copy Invoice".
5.  **Frontend - List Page (`InvoiceListContent.tsx`):** Implement the identical "Actions" dropdown menu for each row in the invoice table.
6.  **Testing:** Thoroughly test all actions from both the detail page and list view, including PDF generation, invoice copying, and status-dependent logic.

## Feature: Orders Table Enhancements

**Goal:** Improve the Orders table by adding VAT Amount and Order Type columns, multi-select checkboxes, and sorting for new columns.

**Tasks:**
1.  **Backend (`orderRouter.list`):** 
    -   Modify the tRPC procedure to return `vatAmount` and `orderType` for each order.
    -   Update the input schema to accept sorting parameters for these new fields.
2.  **Frontend (`OrderListContent.tsx` or equivalent):
    -   Add a new column to display "VAT Amount".
    -   Add a new column to display "Order Type" as a visual pill/tag.
    -   Implement row checkboxes for multi-select functionality.
    -   Update table configuration and state management to enable sorting by "VAT Amount" and "Order Type".
3.  **Testing:** Verify correct data display, distinct pill styling for order types, checkbox functionality, and accurate sorting for the new columns.

## Feature: Free Text Tags (Inventory & BOM)

**Goal:** Allow users to add searchable free-text tags to Inventory Items and Bills of Materials.

**Tasks:**
1.  **Database Schema:** Add `tags: String[] @default([])` to `InventoryItem` and `BillOfMaterial` models in `prisma/schema.prisma`. Run `npx prisma migrate dev`.
2.  **Backend - Inventory (`inventoryRouter`):** Update `create`, `update`, `getById` procedures to handle the `tags` field. Modify the `list` procedure's search logic to include matching against tags.
3.  **Backend - BOM (`bomRouter`):** Update `create`, `update`, `getById` procedures to handle the `tags` field. Modify the `list` procedure's search logic to include matching against tags.
4.  **Frontend - Inventory Form (`InventoryItemForm.tsx`):** Add a suitable input component for managing tags (e.g., chip input, multi-select combobox).
5.  **Frontend - BOM Form (`BomForm.tsx`):** Add a similar tags input component.
6.  **Frontend - Display:** Display tags in the Inventory Item list (new column or within row details) and on relevant BOM list/detail views.
7.  **Testing:** Verify tag creation, editing, deletion, display, and search functionality for both Inventory Items and BOMs.

## Feature: Bill of Material (BOM) Variants

**Goal:** Enable creation and management of BOM variants from a template BOM for manufactured goods.

**Tasks:**
1.  **Database Schema:** 
    -   In `InventoryItem` model: Add `hasVariants: Boolean`, `isVariant: Boolean`, `templateItemId: String?` (self-relation), `variantAttributes: Json?`.
    -   Define the `ItemVariants` relation.
    -   Run `npx prisma migrate dev`.
2.  **Backend - Variant Creation (`inventoryRouter.createVariant`):** Implement the new tRPC procedure:
    -   Validate template item.
    -   Handle SKU generation/input for the variant.
    -   Create the new variant `InventoryItem` record.
    -   Copy the `BillOfMaterial` from the template item to the new variant item.
3.  **Backend - CRUD Updates:** Update existing `inventoryRouter` CRUD operations (`create`, `update`, `getById`) to correctly handle the new variant-related fields if necessary (e.g., when editing a template or a variant).
4.  **Frontend - Template Item Form (`InventoryItemForm.tsx` for `MANUFACTURED_GOOD`):
    -   Add "Has Variants" checkbox.
    -   Conditionally render a "Variants" tab/section.
    -   **Variants Tab UI:**
        *   Implement UI for defining/managing variant attributes (e.g., key-value pairs for Color, Size) on the template item.
        *   Implement UI to list existing variants linked to this template.
        *   Implement UI (button/form) to trigger the `createVariant` tRPC call, allowing selection/input of attribute values for the new variant and SKU confirmation.
5.  **Frontend - Navigation/Editing:** Ensure users can easily navigate to view/edit the variant `InventoryItem` and its specific (copied) `BillOfMaterial`.
6.  **Research & Inspiration:** Review ERPNext's Item Variant and BOM functionality on GitHub ([https://github.com/frappe/erpnext](https://github.com/frappe/erpnext)) for detailed logic and UI/UX patterns.
7.  **Testing:** Thoroughly test the entire workflow: designating an item as a template, defining attributes, creating multiple variants with different attributes, ensuring SKUs are handled correctly, verifying BOMs are copied, and confirming variants can be edited independently.

## Feature: Inventory Excel Import/Export

**Goal:** Allow bulk management of inventory data via Excel file import and export.

**Tasks:**
1.  **Library Integration & Research:** Confirm usage of `Siemienik/XToolset` (`xlsx-import` for parsing, `xlsx-renderer` for generation). Familiarize with its API and capabilities.
2.  **Backend - Export (`inventoryRouter.exportInventoryExcel`):** Implement the tRPC procedure to fetch all inventory data and format it into a structure suitable for `xlsx-renderer`.
3.  **Frontend - Export:** Add an "Export to Excel" button on the Inventory List page. On click, call the `exportInventoryExcel` endpoint and handle the file download (e.g., by constructing a blob from base64 data).
4.  **Backend - Import Preview (`inventoryRouter.previewImportInventoryExcel`):** Implement the tRPC procedure:
    -   Accept base64 encoded file content.
    -   Use `xlsx-import` to parse the Excel data based on expected column headers/order.
    -   Perform row-by-row data type and business rule validation.
    -   Compare with existing inventory (by SKU) to identify new items vs. items to be updated (and detect specific field changes).
    -   Return a structured preview object detailing creations, updates (with diffs), and errors (with row numbers and messages).
5.  **Frontend - Import UI & Preview Modal:**
    -   Add an "Import from Excel" button on the Inventory List page, with a file input.
    -   Create a new modal component (`ExcelImportPreviewModal.tsx`) to display the structured preview from `previewImportInventoryExcel`.
    -   The modal must clearly present items to be created, updated (highlighting changes), and errors.
    -   Include "Confirm Import" and "Cancel" buttons in the modal.
6.  **Backend - Apply Import (`inventoryRouter.applyImportInventoryExcel`):** Implement the tRPC procedure:
    -   Accept the validated lists of items to create and items to update (from the user-confirmed preview).
    -   Perform all database operations (creations and updates) within a single Prisma transaction.
    -   Return a success/failure status with a summary.
7.  **Frontend - Confirmation & Feedback:** When the user confirms in the preview modal, call `applyImportInventoryExcel`. Display appropriate success or error toast notifications based on the result. Refresh the inventory list on success.
8.  **Safeguards & Validation:** Ensure robust data validation at all stages. Emphasize clear error reporting in the preview. Ensure the backend apply step is fully transactional.
9.  **Testing:** Critical path testing. Export inventory, make diverse changes (valid updates, new items, items with deliberate errors in various fields, empty rows, incorrect data types). Import and meticulously verify the preview. Confirm and check database integrity. Test with edge cases (e.g., very large files if feasible, though initial scope might be smaller files).
