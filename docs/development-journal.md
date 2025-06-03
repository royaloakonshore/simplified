# Development Journal

## 2023-11-XX - Project Setup
- Forked GitHub repository and set up the development environment
- Configured Supabase connection with proper URL and credentials
- Set up environment variables in `.env` file
- Initialized and migrated the database with Prisma schema

## 2023-11-XX - Inventory Management Module Implementation
- Defined inventory types in `src/lib/types/inventory.types.ts` (MaterialType, TransactionType, InventoryItem, InventoryTransaction)
- Created validation schemas using Zod in `src/lib/schemas/inventory.schema.ts`
- Implemented server actions for inventory CRUD operations in `src/lib/actions/inventory.actions.ts`
- Aligned Prisma schema with inventory types for database models

## Technical Notes

### Prisma Workflow
When working with Prisma in this project, remember these important steps:

1. **After any schema.prisma changes:**
   - Run `npx prisma generate` to update the TypeScript definitions
   - This ensures the Prisma client includes all models defined in the schema

2. **For database changes:**
   - Run `npx prisma migrate dev --name description-of-changes` to create and apply migrations
   - Never use `npx prisma db push` as specified in the rules

3. **Common issues and solutions:**
   - TypeScript errors like "Property 'modelName' does not exist on type 'PrismaClient'" indicate the client needs regeneration
   - If schema and database get out of sync, migrations may need to be reset or carefully applied

### Inventory Management Implementation Details
- The inventory system uses calculated fields for stock quantities rather than storing them
- Transactions (purchases, sales, adjustments) are used to calculate current stock levels
- Status levels (Critical, Low, Normal) are determined by comparing current stock to minimum and reorder thresholds 

## 2025-04-25: Invoicing Module, Credit Notes, and TS Error Troubleshooting

**Progress:**

1.  **Invoicing Module Core:**
    *   Completed initial setup of types (`src/lib/types/invoice.types.ts`), Zod schemas (`src/lib/schemas/invoice.schema.ts`), and core server actions (`src/lib/actions/invoice.actions.ts`) for CRUD operations, status updates, and payment recording.
    *   Implemented basic UI components: `InvoiceTable` for listing and `InvoiceDetail` for viewing individual invoices.
    *   Implemented `finvoice.service.ts` for generating Finvoice 3.0 XML.
    *   Added `generateAndDownloadFinvoice` server action to fetch data, call the service, and prepare XML for download. A TODO comment was added to emphasize replacing placeholder seller settings with actual data retrieval.

2.  **Credit Note Functionality:**
    *   Added `CREDITED` status to `InvoiceStatus` enum in `prisma/schema.prisma`.
    *   Added `originalInvoiceId` and `creditNoteId` fields with a relation (`CreditRelation`) to the `Invoice` model in the schema.
    *   Ran `prisma migrate dev --name add_credit_note_links` successfully.
    *   Implemented the `createCreditNote` server action in `invoice.actions.ts`, which creates a new invoice with inverted amounts, links it to the original, and updates the original invoice's status to `CREDITED`.
    *   Updated `InvoiceDetail.tsx` UI to include a "Create Credit Note" button (visible for appropriate statuses) and display links to the original/credit note invoice if applicable.
    *   Updated `InvoiceTable.tsx` to recognize and style the `CREDITED` status.

3.  **TypeScript/Prisma Troubleshooting:**
    *   Aligned Prisma schema (`prisma/schema.prisma`) definitions for `OrderStatus`, `Address`, `Customer`, `Invoice`, and `InvoiceItem` models with the application's TypeScript types (`src/lib/types/...`).
    *   Successfully ran `prisma migrate dev --name align_invoice_order_customer_types` to update the database and regenerate the Prisma client.
    *   This resolved several persistent `Property 'X' does not exist on type 'PrismaClient'` errors that were blocking progress.

**Current Context & Issues:**

*   **TypeScript Errors:** Despite the schema alignment resolving some key errors, ~20-23 TypeScript errors remain across various files (`.next/types/*`, `src/app/(erp)/fulfillment/page.tsx`, `src/lib/actions/invoice.actions.ts`, `src/components/orders/OrderForm.tsx`, etc.).
    *   **Persistent Prisma Client Errors:** Errors like `Property 'order' does not exist on type 'PrismaClient'` and `Property 'invoice' does not exist on type 'PrismaClient'` are still present in `invoice.actions.ts` and `fulfillment/page.tsx`. This is unexpected after the migration and client regeneration and needs further investigation (potential caching, TS server issues, or incorrect client instantiation/typing).
    *   **Type Mismatches:** Issues persist with Prisma `Decimal` vs. `number`, `PageProps` constraints in `.next/types/...`, and inferred `any` types.
    *   **Missing Imports/Declarations:** The `FulfillmentBoard` component import in `fulfillment/page.tsx` is failing.
*   **Pending Implementation:**
    *   UI for manual invoice creation (`InvoiceForm`) and modals in `InvoiceDetail` (status update, payment).
    *   Actual implementation for fetching seller settings in `generateAndDownloadFinvoice`.
    *   Comprehensive testing, particularly for Finvoice generation and credit note logic.

**Next Steps:**

*   Prioritize fixing the remaining TypeScript errors, starting with the persistent Prisma client access errors and the missing `FulfillmentBoard` import. 

## 2025-04-26: Invoice Form Implementation & Debugging

**Goal:** Implement the "Create Invoice" form and backend logic.

**Summary:**
- Implemented `InvoiceForm.tsx` using `react-hook-form`, Zod validation (`CreateInvoiceSchema`), and Shadcn UI components.
- Added `invoice.create` tRPC mutation (`src/lib/api/routers/invoice.ts`) to handle invoice creation, including basic sequential numbering (needs improvement for multi-tenancy/concurrency) and total calculations.
- Connected the form to the tRPC mutation.
- Updated the `/invoices/add` page (`src/app/(erp)/invoices/add/page.tsx`) to fetch necessary `customers` and `inventoryItems` data as a Server Component and pass it down.
- Added the `shadcn/ui` Calendar component.

**Debugging & Fixes:**
- Resolved multiple build/type errors:
    - **`nodemailer` Build Error:** Temporarily worked around persistent build errors related to `next-auth`'s Email provider by commenting out the provider configuration in `src/lib/auth/index.ts`. Credentials-based login remains functional. This needs further investigation, possibly related to Webpack/Next.js 15 build process interactions.
    - **`async/await`/`headers` Errors:** Fixed runtime errors on `/orders/add` page by removing an incorrect `'use client'` directive, ensuring the page functions correctly as a Server Component.
    - **`InvoiceListContent` Type Errors:** Corrected several TypeScript errors in the invoice list component (`src/components/invoices/InvoiceListContent.tsx`) related to data types returned by the `invoice.list` tRPC procedure and TanStack Table configuration (`useReactTable` data/column mismatch, `Badge` variant error, etc.).

**Known Issues/Workarounds:**
- **Email Provider Disabled:** As mentioned, Email login is disabled via commenting in `src/lib/auth/index.ts`.
- **`firstName` Field:** The `firstName` field for Users remains commented out in auth callbacks and related components due to prior unresolved type errors. Needs investigation.
- **Invoice Numbering:** The current sequential invoice number generation is basic and prone to race conditions in a concurrent environment. This should be replaced with a database sequence or a more robust locking mechanism when scaling or implementing multi-tenancy.

**Next Steps (Suggestions):**
- Investigate and permanently resolve the `nodemailer` build issue to re-enable the Email provider.
- Resolve the `firstName` type errors and re-enable the field.
- Implement the "Edit Invoice" functionality.
- Improve invoice numbering robustness. 

## 2025-04-27: Feature Planning & Documentation Update

**Goal:** Plan next implementation steps based on user requirements and refine documentation.

**Summary:**
- Discussed requirements for enhancing Orders (Quotes/Work Orders), Invoices (Discounts, VAT RC), Inventory (Pricelist, Stock Alerts), BOMs, and Production views.
- Referenced general ERP patterns (ERPNext) for context.
- Defined implementation plans including necessary schema changes (OrderType, showInPricelist, vatReverseCharge, BOM models, discount fields), tRPC updates, UI modifications, and Finvoice considerations.
- Clarified stock level tracking (calculated from transactions) and negative stock handling (generate alerts, don't block transactions).
- Updated all relevant documentation files (`00-product-requirements.md`, `01-architecture-layout.md`, `02-type-flow-and-finvoice.md`, `03-user-business-flows.md`, `04-agent-implementation-plan.md`, `05-tech-stack-and-patterns.md`) to reflect the merged requirements, corrected information, and removed obsolete details.

**Next Steps:** Proceed with implementing features outlined in Phase 2 of `04-agent-implementation-plan.md`, starting potentially with schema changes and backend logic for Order Types or BOMs.

## 2025-05-02: OrderType Feature Implementation

**Goal:** Implement the OrderType feature to distinguish between Quotations and Work Orders within the Order module.

**Summary:**
- Added `OrderType` enum to Prisma schema with two values: `quotation` and `work_order`
- Updated `Order` model with an `orderType` field defaulting to `work_order`
- Fixed several Prisma schema issues:
  - Added missing `@@schema` attributes to enums
  - Fixed bidirectional relations between Order and Invoice
  - Added missing `orders` relation on the User model for the Order-User relation
- Updated Zod validation schemas in `order.schema.ts` to include orderType
- Updated the order tRPC router to handle orderType in create/update operations
- Updated UI components with OrderType display:
  - Added orderType selection field to OrderForm
  - Added orderType badge to OrderTable
  - Added orderType badge to OrderDetail
  - Added descriptive hints in the UI explaining the difference between types

**Debugging & Fixes:**
- Resolved build errors related to Prisma schema validation
- Fixed import issues for OrderType in the router
- Resolved relation issues in the schema for proper database structure
- Fixed any form type issues related to OrderType selection

**Next Steps:**
1. **BOM Module Implementation:**
   - Define `BillOfMaterial` and `BillOfMaterialItem` schemas in Prisma
   - Create tRPC router for BOM CRUD operations
   - Implement BOM creation/edit form UI
   - Add cost calculation logic for BOMs

2. **Order/Invoice Line Item Enhancements:**
   - Add discount fields to OrderItem/InvoiceItem schemas
   - Update forms with discount controls
   - Add VAT handling and reverse charge functionality to invoices 

3. **Inventory Enhancements:**
   - Add `showInPricelist` field to InventoryItem schema
   - Implement UI for pricelist filtering and display
   - Create stock alert detection logic
   - Add UI components for alerts
   
4. **Production Integration:**
   - Implement inventory deduction for production based on BOMs
   - Connect order status transitions to inventory transactions 

## 2025-05-23: Profile Update and Order Creation Fixes

**Goal:** Resolve critical errors preventing user profile updates and order creation.

**Summary:**

1.  **User Profile Update (`user.updateProfile`):**
    *   **Problem:** Users were encountering an error when attempting to update their profile information.
    *   **Investigation:** The error was traced to the `user.updateProfile` tRPC mutation in `src/lib/api/routers/user.ts`. The handling of the `firstName` field was commented out in both the backend mutation (data update and select statement) and in the frontend `SettingsPage` component (`src/app/(erp)/settings/page.tsx`) during the session update and form reset logic.
    *   **Solution:** Uncommented and corrected the `firstName` handling in both the backend tRPC mutation and the frontend component's `onSuccess` handler for the mutation. This ensured that `firstName` is correctly passed, updated in the database, returned, and reflected in the user's session and form.

2.  **Order Creation (`order.create`):**
    *   **Problem:** Order creation was failing with a "Foreign key constraint violated: `Order_userId_fkey (index)`" error.
    *   **Investigation:**
        *   Added logging to the `order.create` tRPC mutation in `src/lib/api/routers/order.ts` to inspect the `userId` being retrieved from the session (`ctx.session.user.id`).
        *   The logs confirmed that a `userId` was present in the session.
        *   The error indicated that this `userId` from the session did not correspond to an existing user in the `User` table in the `public` schema. This typically happens if the session ID is stale (e.g., user deleted, database reset without session invalidation).
    *   **Solution:**
        *   Guided the user to generate a fresh UUID for the user ID and a new bcrypt hash for the password.
        *   Instructed the user to update their primary test/admin user record in the `User` table with these new values.
        *   Advised logging out and logging back in to ensure the session picks up the corrected and valid `userId`.
    *   **Outcome:** After these steps, order creation functionality was restored.

**Next Steps:**
- Continue with planned feature development, starting with QR Code generation and the mobile scanning page.
- Thoroughly document these new features as they are implemented. 

## 2025-05-24: Decimal Conversion Runtime Error Fix & Current Status

**Goal:** Resolve runtime error on invoice detail page and document current project status and next steps.

**Summary:**

1.  **Runtime Error Fix (`prismaInvoice.totalAmount.toNumber`):**
    *   **Problem:** A runtime error `TypeError: prismaInvoice.totalAmount.toNumber is not a function` was occurring on the invoice detail page (`src/app/(erp)/invoices/[id]/page.tsx`).
    *   **Investigation:**
        *   The error occurred within the `mapPrismaInvoiceToLocal` function in the page component.
        *   It was identified that the `getInvoiceById` server action (`src/lib/actions/invoice.actions.ts`) also contained a `mapPrismaInvoiceToLocal` function.
        *   This server-side mapper was already converting Prisma `Decimal` types (like `totalAmount`) to JavaScript `number`s using `.toNumber()`.
        *   When this pre-converted `number` reached the page component's mapper, calling `.toNumber()` on it again caused the error.
    *   **Solution:** Modified the `mapPrismaInvoiceToLocal` function within `src/lib/actions/invoice.actions.ts` to *not* call `.toNumber()` on `Decimal` fields. Instead, these fields are now passed through as Prisma `Decimal` objects. The existing mapper in `src/app/(erp)/invoices/[id]/page.tsx` correctly handles the `.toNumber()` conversion, thus resolving the error.
    *   **Outcome:** The invoice detail page now renders correctly without the runtime error. The build was successful post-fix.

**Current Project Status & Pending Features:**

The core ERP application is progressing, with key modules like Orders, Invoices, Customers, and basic Inventory in place. Authentication and user settings are functional. Recent efforts focused on stabilizing existing features and UI refinements.

However, several significant features and enhancements are pending implementation:

1.  **Bill of Materials (BOM):**
    *   Full CRUD operations for BOMs (creation, editing, viewing, deletion).
    *   Linking BOMs to manufactured inventory items.
    *   Cost calculation for BOMs.
2.  **Inventory Item Enhancements:**
    *   Adding a `quantity` field to `InventoryItem` (clarify if for stock or other purposes, especially for manufactured items).
    *   Implementing a clear distinction and selection mechanism for `InventoryItem` types (e.g., `RAW_MATERIAL`, `MANUFACTURED_GOOD`).
    *   Logic for how these types interact with BOMs and stock.
3.  **Price Lists:**
    *   Functionality to add/manage items (including BOM-defined manufactured goods) in price lists.
    *   A dedicated "Price List View" in the UI.
4.  **Order & Invoice Workflow:**
    *   Review and potentially offer user choices for status assignment upon creation of new Orders and Invoices (e.g., create Order as `confirmed`, Invoice as `sent`).
5.  **Order Details Page:**
    *   Implement a "PDF Export/Print" button for orders.
6.  **Finvoice Seller Details:**
    *   Integrate actual seller company settings (from `Settings` model) into `finvoice.service.ts` and the `generateAndDownloadFinvoice` action/tRPC endpoint, replacing placeholder data.
7.  **General UI/UX Refinements:**
    *   Continued focus on consistency, mobile responsiveness, and addressing any minor UI bugs or inconsistencies.

**Next Immediate Steps (High Priority):**

*   Address the pending features listed above, likely starting with BOM functionality and the related inventory item enhancements as these are critical for manufacturing flows.
*   Integrate company settings into Finvoice generation.
*   Clarify requirements for Inventory Item `quantity` and `type` to ensure correct implementation.
*   Define the scope and information for the "Price List View".
*   Determine the desired behavior for Order/Invoice status assignment on creation.
*   Investigate and select a PDF generation approach for order printing.

**Next Steps:**
- Continue with planned feature development, starting with QR Code generation and the mobile scanning page.
- Thoroughly document these new features as they are implemented. 

## YYYY-MM-DD: Planning Session - Major Feature Enhancements

**Attendees:** AI Agent, User

**Features Planned & Documented:**

1.  **Invoice Actions Refactor:**
    *   **Summary:** Consolidate existing buttons (Update Status, Record Payment) into a single actions dropdown on `InvoiceDetail.tsx` and invoice list rows. Add new actions: "Export as PDF" and "Copy Invoice". "Mark as Paid" will handle payment recording.
    *   **Documentation Impacted:** `00-product-requirements.md`, `03-user-business-flows.md`, `01-architecture-layout.md`, `04-agent-implementation-plan.md`, `06-ui-and-feature-roadmap.md`.
    *   **Key Considerations:** Logic for `Mark as Paid` to correctly update payment status/date. Consistent UI for dropdown in detail and list views. Puppeteer for PDF generation.

2.  **Orders Table Enhancements:**
    *   **Summary:** Add "VAT Amount" and "Order Type" (as a pill/tag) columns to the Orders table. Implement multi-select checkboxes and enable sorting for new columns.
    *   **Documentation Impacted:** `00-product-requirements.md`, `03-user-business-flows.md`, `01-architecture-layout.md`, `04-agent-implementation-plan.md`, `06-ui-and-feature-roadmap.md`.
    *   **Key Considerations:** Backend API updates to return necessary data and handle sorting. Frontend table component modifications.

3.  **Free Text Tags (Inventory & BOM):**
    *   **Summary:** Add a `tags: String[]` field to `InventoryItem` and `BillOfMaterial` models. Update forms to manage tags and list views/search to use them.
    *   **Documentation Impacted:** `00-product-requirements.md`, `03-user-business-flows.md`, `01-architecture-layout.md`, `04-agent-implementation-plan.md`, `06-ui-and-feature-roadmap.md`.
    *   **Key Considerations:** Prisma schema migration. Backend API and search logic updates. Frontend UI for tag input (e.g., chip input).

4.  **Bill of Material (BOM) Variants:**
    *   **Summary:** Allow `MANUFACTURED_GOOD` Inventory Items to be marked as "Has Variants". Enable defining attributes for variants. Variant creation involves copying the template item's BOM, creating a new variant `InventoryItem` with a distinct SKU (auto-suggested, user-editable) and linked attributes.
    *   **Documentation Impacted:** `00-product-requirements.md`, `03-user-business-flows.md`, `01-architecture-layout.md`, `04-agent-implementation-plan.md`, `06-ui-and-feature-roadmap.md`.
    *   **Key Considerations:** Significant data model changes (self-referencing `InventoryItem` relation, JSON for attributes). New tRPC procedures for variant creation. Complex UI for managing template attributes and variants. Inspired by ERPNext.

5.  **Inventory Data Management via Excel Import/Export:**
    *   **Summary:** Implement export of inventory to Excel. Implement import from Excel with SKU-based matching, comprehensive preview (creations, updates with diffs, errors), and transactional database updates upon user confirmation.
    *   **Documentation Impacted:** `00-product-requirements.md`, `03-user-business-flows.md`, `01-architecture-layout.md`, `04-agent-implementation-plan.md`, `06-ui-and-feature-roadmap.md`.
    *   **Key Considerations:** Use of `Siemienik/XToolset` (xlsx-import, xlsx-renderer). Robust validation and error handling. Crucial preview step for user confirmation to prevent data corruption. Transactional updates.

**Immediate Technical Debt / Points to Note from this Planning:**

*   **Prisma Schema Changes:** Multiple features require schema updates. These should be batched if possible or handled sequentially with careful migration naming.
*   **API Design:** New tRPC endpoints and modifications to existing ones are significant. Ensure Zod schemas are updated accordingly.
*   **ERPNext Research (BOM Variants):** Dedicated time will be needed to study the [ERPNext GitHub repository](https://github.com/frappe/erpnext) for best practices and detailed logic regarding item variants and BOM attribute handling before starting implementation.
*   **Excel Import/Export Library:** Confirm the suitability and licensing of `Siemienik/XToolset`. Perform a small proof-of-concept if necessary before full integration.
*   **Shared Components:** For tag input and action dropdowns, consider creating reusable components if not already available via Shadcn/ui or internal component library.
*   **User Experience (Excel Import):** The preview and confirmation step for Excel import is critical. Design must be very clear and user-friendly to prevent accidental data issues.

**Next Steps (Development Order to be prioritized with User):**
*   Begin implementation based on user priority after this documentation phase. 

## YYYY-MM-DD: BOM UI Scaffolding, Schema Update, and Blockers

**Goal:** Initiate Bill of Materials (BOM) UI development and address structural schema requirements.

**Summary of Progress:**

1.  **BOM UI - Initial Scaffolding:**
    *   Verified existing backend tRPC procedures (`src/lib/api/routers/bom.ts`) and Zod schemas (`src/lib/schemas/bom.schema.ts`) for BOM CRUD operations. Noted TODOs for `companyId` and `ItemType` import in the router.
    *   Added a "Bill of Materials" navigation link to `src/components/AppSidebar.tsx` (using `FileText` as a placeholder icon).
    *   Created the basic page structure for the BOM module:
        *   `src/app/(erp)/boms/page.tsx` (List View)
        *   `src/app/(erp)/boms/add/page.tsx` (Add New BOM)
        *   `src/app/(erp)/boms/[id]/edit/page.tsx` (Edit BOM)
        *   `src/app/(erp)/boms/[id]/page.tsx` (View Single BOM)
    *   Implemented `src/components/boms/BOMTable.tsx` using TanStack Table for displaying a list of BOMs. Resolved initial linter errors related to type inference for table rows.
    *   Implemented a basic `src/components/boms/BOMForm.tsx`:
        *   Utilizes `react-hook-form` and Zod schemas for validation.
        *   Includes `useFieldArray` for managing BOM component items.
        *   Integrated a new `src/components/ui/combobox-responsive.tsx` for selecting manufactured items and component items.
        *   Connects to `api.bom.upsert.useMutation` for saving data, with basic success/error handling.
        *   Handles `initialData` for edit mode, including conversion of Prisma `Decimal` types to `number` for `quantity` and `manualLaborCost`.
        *   Resolved linter errors, including an issue with `manualLaborCost` default value by adjusting its Zod schema to `z.number().nonnegative()`.
    *   Updated `src/app/(erp)/boms/page.tsx` (list page) to fetch and display BOMs using `BOMTable`.
    *   Updated `src/app/(erp)/boms/add/page.tsx` and `src/app/(erp)/boms/[id]/edit/page.tsx` to fetch `inventoryItems` (for manufactured goods and raw materials selection) using `api.inventory.list.useQuery`, correcting `perPage` limits.

2.  **BOM Schema Update (Manufactured Item Optionality):**
    *   Based on user request, the `manufacturedItemId` field in the `BillOfMaterial` model was made optional to allow BOM creation without an immediate link to a specific manufactured product.
    *   Modified `prisma/schema.prisma`: `BillOfMaterial.manufacturedItemId` changed from `String @unique` to `String? @unique`. The `manufacturedItem` relation was also updated to be optional.
    *   Updated `src/lib/schemas/bom.schema.ts`: The `manufacturedItemId` in `UpsertBillOfMaterialSchema` was changed to `.optional().nullable()`.
    *   Successfully executed `npx prisma migrate dev --name make_bom_manufactured_item_optional`.

**Current Blockers & Issues:**

*   **Persistent Linter Errors in `src/components/invoices/InvoiceDetail.tsx`:** Multiple attempts to automatically fix linter errors (duplicate imports, type mismatches, property access) in this file have been unsuccessful. The file likely requires manual review and correction to achieve a clean type check.
*   **Build Error in `src/app/(erp)/boms/[id]/page.tsx`:** A critical build error prevents the BOM detail view page from functioning. The error message is: `Type 'ViewBillOfMaterialPageProps' does not satisfy the constraint 'PageProps'. Types of property 'params' are incompatible...` Previous attempts to resolve this by adjusting props or checking for client-side directives were not successful.

**New User Requirements (Pending Implementation for BOM):**

*   **Enhanced Raw Material Selection:** For the `BOMForm`, implement a more user-friendly way to add multiple raw materials. This should involve displaying the raw material inventory in a table format (showing minimal columns like Name, SKU, Quantity on Hand), allowing users to select multiple items via checkboxes, and then adding them to the BOM's component list with a single action. This is to improve efficiency when dealing with BOMs that have many components.

**Next Steps (Development Order to be prioritized with User):**
1.  Manual correction of linter errors in `src/components/invoices/InvoiceDetail.tsx`.
2.  Resolve the build error in `src/app/(erp)/boms/[id]/page.tsx`.
3.  Implement the enhanced raw material selection UI for `BOMForm.tsx`.
4.  Continue fleshing out BOM UI features (view page, delete functionality, etc.). 