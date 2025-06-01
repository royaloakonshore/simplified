# Architecture Layout - Simplified ERP System

## 1. Overview

This ERP system utilizes a modern web architecture based on Next.js (App Router), React, TypeScript, and Prisma. It emphasizes server-side rendering (SSR) and React Server Components (RSC) for performance and reduced client-side load, with minimal, targeted use of Client Components for interactivity.

**Current Context & Progress:**
The system has a stable build with core modules for Invoicing, Orders (Quotes/Work Orders), Inventory, Customers, and basic Settings/User Management implemented. Key functionalities like Finvoice export (partially integrated), order-to-invoice flow, and BOM-driven inventory deduction for production are in place. The UI uses shadcn/ui components and a Next.js App Router structure. Authentication is handled by NextAuth. tRPC is used for API communication, and Prisma for database interactions. Recent work has focused on resolving numerous build errors and type errors across the codebase, including in the inventory router. `InventoryItem.defaultVatRatePercent` is now correctly used in invoice creation, with a fallback to company-level defaults. The `settings.get` tRPC procedure now returns `null` if no settings exist, which the client handles gracefully. The `TRPCReactProvider` is correctly set up with cookies in the root layout. The project currently passes `npm run build` and `npx tsc --noEmit` shows no errors.

## 2. Technology Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **UI Library:** React 18+, Shadcn UI
- **Styling:** Tailwind CSS
- **State Management:** Primarily URL State and React Query. Zustand for minimal global UI state (e.g., sidebar).
- **Forms:** React Hook Form + Zod
- **Data Fetching/API:** tRPC (client/server)
    - `settings.get` now returns `null` if no settings for the company are found, requiring client-side handling (e.g., guiding user to create settings or disabling features).
    - **NEW:** Searchable select components (e.g. using popover with search) for Item and Customer selection in Order/Invoice forms will be a key UI pattern.
- **Database ORM:** Prisma
- **Database Hosting:** PostgreSQL (e.g., via Supabase, Neon, local)
- **Authentication:** NextAuth.js (with Prisma Adapter)

## 4. Component Strategy

- **Server Components First:** Default to Server Components for data fetching and rendering static or server-rendered content.
- **Client Components (`\'use client\'`):** Use only when necessary for interactivity. Fetch data and perform mutations using tRPC React Query hooks.
- **Composition:** Build complex UIs by composing smaller, reusable components.
- **Data Fetching:** Primarily via tRPC procedures. Use Suspense for loading states.

## 5. State Management

- **URL State:** Preferred for UI state like filters, sorting, pagination.
- **tRPC & React Query:** Handle server state, mutations, caching, and optimistic updates.
- **Zustand:** Reserved for truly global client-side UI state (e.g., sidebar open/closed state).

## 6. Error Handling

- **tRPC Procedures:** Throw `TRPCError` for expected errors.
- **Client Components:** Use React Error Boundaries. Handle tRPC errors using React Query's `onError` callbacks.
- **UI:** Display user-friendly error messages (e.g., using Shadcn `Toast`).

## 7. Database Design

- See `prisma/schema.prisma` for the database schema.
- Key features and recent changes:
    - `Order` model: `orderType` enum (`quotation`, `work_order`). SKU handling for order items is correct.
    - `Invoice` model: `vatReverseCharge` boolean. `defaultVatRatePercent` from `InventoryItem` used in calculations, with a fallback to company-level default VAT from `Settings` model when creating invoices from orders. **[Fallback Implemented]**
    - `InventoryItem` model: Uses `itemType: ItemType`. `quantityOnHand` is calculated. `defaultVatRatePercent` field added. **New requirements include: directly editable `quantityOnHand` field (this is now implemented in the schema, form, and tRPC, replacing initial/adjust by X), `leadTimeDays` field (implemented), `vendorSku` and `vendorItemName` fields (implemented, conditional visibility in UI pending), and linking to `InventoryCategory` for filtering (pending).**
    - `Settings` model: Includes `defaultVatRatePercent` for company-wide VAT settings.
    - `BillOfMaterial` and `BillOfMaterialItem` models manage BOM structures. Backend tRPC procedures for CRUD are implemented; UI is pending.
    - `InvoiceItem` model: Includes fields for profitability tracking.
    - `Invoice` model: `totalAmount` is NET, `totalVatAmount` stores calculated VAT.
- Prisma Migrate (`npx prisma migrate dev`) is used for schema changes.
- **Stock Alerts:** Negative stock levels are permitted. Alert generation/display is pending.

## 8. Architecture Layout & Project Structure

Utilizes a standard Next.js App Router structure with feature-based organization.

### 8.1. Core Principles

*   Next.js App Router (RSC by default).
*   TypeScript (strict mode).
*   Modular Design.
*   Prisma ORM.
*   NextAuth.js.
*   tRPC for API.
*   Shadcn UI & Tailwind.

### 8.2. Expected Directory Structure (Simplified)

```
erp-system/
├── src/
│   ├── app/             # Next.js App Router (routes, layouts)
│   │   ├── (auth)/      # Auth routes
│   │   ├── (main)/      # Authenticated app routes (dashboard, customers, inventory, etc.)
│   │   ├── api/         # API routes (tRPC, NextAuth)
│   │   ├── components/  # Reusable UI components (feature-specific, core, ui)
│   │   ├── lib/         # Core logic, utilities, types, services
│   │   │   ├── api/     # tRPC (root router, trpc setup, feature routers)
│   │   │   ├── schemas/ # Zod validation schemas
│   │   │   ├── services/ # Business logic services (e.g., Finvoice)
│   │   │   ├── trpc/    # tRPC client setup
│   │   │   └── ...      # db.ts, utils.ts, types.ts, etc.
│   │   ├── middleware.ts # Next.js middleware
│   ├── prisma/          # Prisma schema and migrations
│   └── ...              # Config files, public assets, etc.
```

### 8.3. Key Components & Interactions

*   Layouts (`src/app/layout.tsx`, `src/app/(main)/layout.tsx`) manage structure and providers. `TRPCReactProvider` correctly initialized with cookies.
*   Feature Routes (e.g., `src/app/(main)/inventory/page.tsx`) use Server Components and tRPC.
*   UI Components (`src/components/`) are built with Shadcn and custom elements.
*   tRPC Procedures (`src/lib/api/routers/`) handle API logic.
*   Middleware (`src/middleware.ts`) handles session management.

## 9. Key Feature Implementation Notes & Next Steps

- **Order Types (Quote/Work Order):** Implemented.
- **Discounts & VAT Reverse Charge (Invoices):** Implemented.
- **Inventory & Pricelist:**
    - Basic inventory list exists. `showInPricelist` flag in schema.
    - **NEXT:** Implement a single, directly editable `quantityOnHand` field in `InventoryItemForm` and the inventory list table (with a new tRPC mutation for quick stock adjustment), replacing the previous "initial quantity/adjust by X" approach. **[Form & backend logic DONE. List table editing PENDING]**
    - **NEXT:** Add `leadTimeDays` field to `InventoryItem` and display it. **[Field implemented. Display in table PENDING]**
    - **NEXT:** Add `vendorSku` and `vendorItemName` fields (conditionally hidden for manufactured goods) to `InventoryItem`. **[Fields implemented. Conditional UI hiding & display in table PENDING]**
    - **NEXT:** Add "Product Category" (`InventoryCategory`) column to the inventory table and enable filtering by it (displaying categories as pill tags). **[PENDING]**
    - **NEXT:** Enhance inventory table with a search bar, and robust filtering, pagination, and sorting (similar to `CustomerTable`).
    - **NEXT:** PDF export for pricelist.
- **BOMs:** Backend implemented. **NEXT: UI for BOM management.**
- **Inventory Deduction for Production:** Implemented (when order status changes to `in_production`).
- **Production Kanban/Table:**
    - Basic Kanban view exists, cards link to orders.
    - **NEXT:** Implement a BOM information view (modal/expandable section) within Kanban cards/table rows for manufactured items.
- **Customer History:** tRPC procedures exist. **NEXT: UI for displaying order/invoice history and total net revenue on customer detail page.**
- **Customer Table Actions (NEW):** **NEXT: Change the "Edit" button on Customer table rows to a dropdown menu with icons for "Create Invoice", "Create Quotation", "Create Work Order", and "Edit Customer", pre-filling customer data.**
- **Order/Invoice Table Enhancements (NEW):** **NEXT: Add multi-select checkboxes and bulk action capabilities (e.g., "Print PDF" placeholder) to Order and Invoice tables.**
- **Searchable Selects (NEW):** **NEXT: Implement searchable select components for Item and Customer dropdowns in Order and Invoice forms.**
- **PDF Generation:** Strategy is server-side. **NEXT: Implement for Invoices, Orders, Pricelists, Credit Notes.**
- **Finvoice:** Partially implemented. **NEXT: Full integration of Company Settings into Finvoice XML.**
- **Credit Notes:** Backend/schema prepped. **NEXT: UI and full workflow.**
- **Stock Alerts:** Logic for negative stock exists. **NEXT: UI for displaying stock alerts (low stock, negative stock).**
- **Dashboard & Reporting:** Basic dashboard page exists. **NEXT: Populate with actual data, metrics, and charts. Develop sales, inventory, and profitability reports.**

### Prisma Schema (`prisma/schema.prisma`)

The schema includes `InventoryItem.defaultVatRatePercent`. `quantityOnHand` is derived from `InventoryTransaction`s. Profitability fields are in `InvoiceItem`.

#### Key Calculation Logic & Data Flows

*   **BOM Cost Calculation:** Server-side on `BillOfMaterial` save/update.
*   **Invoice Line Profitability:** Calculated during `Invoice` creation/finalization.
*   **Invoice Totals:** Calculated during `Invoice` creation/finalization (Net + VAT).
*   **Customer History & Revenue:** Data fetched via tRPC for customer detail page (UI Pending).

**Overall Next Steps (Summary from above):**
1.  **Inventory Module Enhancements:** Directly editable `quantityOnHand` in list table, `leadTimeDays` display, `vendorSku`/`vendorItemName` conditional UI & display, `InventoryCategory` integration (pill tags, filtering), advanced table features. **[Directly editable QOH in form and new fields in schema/form/tRPC are DONE. Remaining items listed are PENDING.]**
2.  **Production View Enhancements:** BOM display in Kanban/table.
3.  **Customer Module Enhancements:** Customer table action dropdown, Customer history UI.
4.  **Order & Invoice Module Enhancements:** Searchable select dropdowns for items/customers, multi-select checkboxes and bulk actions in tables.
5.  **BOM Management UI.**
6.  **Dashboard & Reporting Implementation.**
7.  **PDF Generation for key documents.**
8.  **Finalize Finvoice Integration & Credit Note Flow.**
9.  **Implement Stock Alert Display.**
10. **Prioritize Build Health:** Maintain passing `npm run build` and clean `npx tsc --noEmit` throughout development. **[Currently Stable]**
11. **Comprehensive Testing & UI/UX Refinement.**

## 5. Data Model Enhancements (Prisma Schema)

This section outlines planned additions and modifications to the Prisma schema to support new features.

### 5.1. `InventoryItem` Model Enhancements

```prisma
// Existing InventoryItem fields ...

// For Free Text Tags
tags String[] @default([])

// For BOM Variants
hasVariants Boolean @default(false) // Applicable if itemType is MANUFACTURED_GOOD
isVariant Boolean @default(false)
templateItemId String? // Foreign key to self-referencing relation for variants
variantAttributes Json? // Stores specific attribute combination, e.g., {"Color": "Red", "Size": "M"}

// Relation for template item and its variants
templateItem InventoryItem? @relation("ItemVariants", fields: [templateItemId], references: [id], onDelete: Nullify, onUpdate: Cascade)
variants InventoryItem[] @relation("ItemVariants")

// companyId and userId as before
// timestamps as before
```

### 5.2. `BillOfMaterial` Model Enhancements

```prisma
// Existing BillOfMaterial fields ...

// For Free Text Tags
tags String[] @default([])

// manufacturedItemId, items, companyId, userId etc. as before
// timestamps as before
```

## 6. API Design Enhancements (tRPC Routers)

### 6.1. `invoiceRouter`

-   **`actions.updateStatus (input: { id: string; status: PrismaInvoiceStatus })`**
    -   Modify to ensure that if `status` is set to `PAID`, the backend logic correctly records payment details (e.g., sets `paymentDate`, updates `paidAmount`).
-   **`actions.exportPdf (input: { id: string })` (New)**
    -   **Description:** Generates a PDF document for the specified invoice.
    -   **Logic:** Fetches invoice details (customer, items, totals). Uses a service (potentially Puppeteer, similar to existing QR code PDF generation) to render an HTML template of the invoice into a PDF.
    -   **Returns:** Base64 encoded string of the PDF or necessary data for client-side download.
-   **`actions.copyInvoice (input: { id: string })` (New)**
    -   **Description:** Creates a new draft invoice based on an existing one.
    -   **Logic:** 
        1.  Fetches the details of the source invoice (`id`).
        2.  Creates a new invoice record with status `DRAFT`.
        3.  Copies customer information, line items (description, quantity, unit price, VAT rate), and other relevant fields.
        4.  Generates a new `invoiceNumber`.
        5.  Sets new `invoiceDate` (e.g., today) and `dueDate` (e.g., today + default payment terms).
    -   **Returns:** The newly created invoice object or its ID.

### 6.2. `orderRouter`

-   **`list (input: ListOrdersSchema)`**
    -   Modify input schema (`ListOrdersSchema`) to accept sorting parameters for `vatAmount` (if calculated and returned) and `orderType`.
    -   Ensure the procedure returns `vatAmount` and `orderType` for each order in the list.

### 6.3. `inventoryRouter`

-   **CRUD Operations (`create`, `update`, `getById`)**
    -   Modify input schemas and logic to handle new `InventoryItem` fields: `tags`, `hasVariants`, `isVariant`, `templateItemId`, `variantAttributes`.
-   **`list (input: ListInventoryItemsSchema)`**
    -   Modify input schema to include filtering/searching by `tags`.
    -   Update Prisma query to search within the `tags` array (e.g., using `array_contains` or similar, depending on DB and Prisma capabilities for array searching).
-   **`createVariant (input: { templateItemId: string; attributes: Json; sku?: string })` (New)**
    -   **Description:** Creates a new variant `InventoryItem` and its associated `BillOfMaterial` based on a template item.
    -   **Logic:**
        1.  Validate that `templateItemId` refers to an existing `InventoryItem` where `itemType` is `MANUFACTURED_GOOD` and `hasVariants` is (or can be set to) `true`.
        2.  Generate/validate the SKU for the new variant (user-provided or auto-generated from template SKU + attributes).
        3.  Create the new variant `InventoryItem` record, setting `isVariant = true`, linking `templateItemId`, and storing `variantAttributes` and the new SKU.
        4.  Fetch the `BillOfMaterial` associated with the `templateItemId`.
        5.  Create a new `BillOfMaterial` record, copying items and details from the template BOM, and associating it with the newly created variant `InventoryItem`.
    -   **Returns:** The new variant `InventoryItem` object, possibly including its new `BillOfMaterial`.
-   **`exportInventoryExcel ()` (New)**
    -   **Description:** Exports all inventory items to an Excel-compatible format.
    -   **Logic:** Fetches all inventory items with all relevant fields. Formats this data into a structure (e.g., array of arrays, or array of objects) suitable for an Excel generation library.
    -   **Returns:** Data for Excel generation (e.g., base64 string of the file, or a structure the client can use with a library like `xlsx-renderer`).
-   **`previewImportInventoryExcel (input: { fileContentBase64: string })` (New)**
    -   **Description:** Parses an uploaded Excel file, validates its content against inventory data, and returns a preview of changes.
    -   **Logic (using `xlsx-import` from `Siemienik/XToolset`):
        1.  Decode `fileContentBase64` to a buffer.
        2.  Use `xlsx-import` to parse the buffer into a JavaScript array of objects, based on a predefined mapping configuration (column headers to `InventoryItem` fields).
        3.  For each parsed row:
            a.  Perform data type validation and business rule validation (e.g., required fields, valid `ItemType`, non-negative prices).
            b.  If SKU exists, compare row data with the existing `InventoryItem` in the database to identify changes.
            c.  If SKU does not exist, mark as a new item.
    -   **Returns:** A structured object: `{ itemsToCreate: [], itemsToUpdate: [{ itemId: string, changes: { field: { oldValue, newValue } } }], errors: [{ rowIndex, field, message }] }`.
-   **`applyImportInventoryExcel (input: { itemsToCreate: InventoryItemCreateInput[]; itemsToUpdate: InventoryItemUpdateInput[] })` (New)**
    -   **Description:** Applies the validated and confirmed changes from an Excel import to the database.
    -   **Logic:**
        1.  Perform all database operations within a single Prisma transaction (`prisma.$transaction([...])`).
        2.  For each item in `itemsToCreate`, create a new `InventoryItem`.
        3.  For each item in `itemsToUpdate`, update the existing `InventoryItem`.
    -   **Returns:** Success status and summary (e.g., `{ success: true, createdCount: number, updatedCount: number }`) or error details.

### 6.4. `bomRouter`

-   **CRUD Operations (`create`, `update`, `getById`)**
    -   Modify input schemas and logic to handle the new `tags` field.
-   **`list (input: ListBomSchema)`**
    -   Modify input schema to include filtering/searching by `tags`.
    -   Update Prisma query to search within the `tags` array.

## 7. Frontend Architecture Considerations

### 7.1. Key Component Modifications

-   **`InvoiceDetail.tsx` & `InvoiceListContent.tsx` (or equivalent for invoice list rows):**
    -   Refactor action buttons into a single, comprehensive dropdown menu component for all invoice actions (status changes, PDF export, copy, credit note, Finvoice export).
-   **`OrderListContent.tsx` (or equivalent for order list):**
    -   Add new columns for "VAT Amount" and "Order Type" (with pill/tag styling).
    -   Implement multi-select checkbox functionality for rows.
    -   Update data fetching and table configuration to support sorting by the new columns.
-   **`InventoryItemForm.tsx`:**
    -   Add a new input component for managing an array of `tags` (e.g., a multi-select combobox or a chip input field).
    -   Add a "Has Variants" checkbox, visible if `itemType` is `MANUFACTURED_GOOD`.
    -   Conditionally render a "Variants" tab/section if "Has Variants" is checked. This section will contain:
        *   UI for defining/editing attributes applicable to variants of this template item.
        *   A list of existing variant items linked to this template.
        *   A button/flow to trigger the creation of a new variant (`inventoryRouter.createVariant`).
-   **`BomForm.tsx`:**
    -   Add a new input component for managing an array of `tags`.
-   **Inventory List Page (`inventory/page.tsx` and its content component):**
    -   Add "Export to Excel" button (triggers `inventoryRouter.exportInventoryExcel()` and handles download).
    -   Add "Import from Excel" button (handles file upload).
-   **`ExcelImportPreviewModal.tsx` (New Component):**
    -   A modal dialog to display the preview data from `inventoryRouter.previewImportInventoryExcel()`.
    -   Clearly shows items to be created, items to be updated (with diffs), and errors.
    -   Provides "Confirm Import" and "Cancel" actions.

### 7.2. State Management

-   For BOM Variants attribute definition and Excel import preview, local component state or simple context might be sufficient. Complex global state is likely not needed for these specific features initially.

## 8. External Libraries & Services

-   **`Siemienik/XToolset` (`xlsx-import`, `xlsx-renderer`):**
    -   **Purpose:** To be used for parsing uploaded Excel files (`xlsx-import`) during the inventory import process and for generating Excel files (`xlsx-renderer`) for the inventory export feature.
    -   **Reference:** [https://github.com/Siemienik/XToolset](https://github.com/Siemienik/XToolset), [https://siemienik.com/docs/xlsx-import/](https://siemienik.com/docs/xlsx-import/)
-   **Puppeteer (existing for QR codes):**
    -   **Purpose:** Can be leveraged for server-side PDF generation for invoices ("Export Invoice PDF" feature) by rendering an HTML template of the invoice and converting it to PDF.
