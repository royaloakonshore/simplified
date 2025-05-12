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

## [YYYY-MM-DD] - Invoice Form Implementation & Debugging

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

## [YYYY-MM-DD] - Feature Planning & Documentation Update

**Goal:** Plan next implementation steps based on user requirements and refine documentation.

**Summary:**
- Discussed requirements for enhancing Orders (Quotes/Work Orders), Invoices (Discounts, VAT RC), Inventory (Pricelist, Stock Alerts), BOMs, and Production views.
- Referenced general ERP patterns (ERPNext) for context.
- Defined implementation plans including necessary schema changes (OrderType, showInPricelist, vatReverseCharge, BOM models, discount fields), tRPC updates, UI modifications, and Finvoice considerations.
- Clarified stock level tracking (calculated from transactions) and negative stock handling (generate alerts, don't block transactions).
- Updated all relevant documentation files (`00-product-requirements.md`, `01-architecture-layout.md`, `02-type-flow-and-finvoice.md`, `03-user-business-flows.md`, `04-agent-implementation-plan.md`, `05-tech-stack-and-patterns.md`) to reflect the merged requirements, corrected information, and removed obsolete details.

**Next Steps:** Proceed with implementing features outlined in Phase 2 of `04-agent-implementation-plan.md`, starting potentially with schema changes and backend logic for Order Types or BOMs. 