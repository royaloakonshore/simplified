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