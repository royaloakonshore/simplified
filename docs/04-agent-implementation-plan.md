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

**Phase 1: Foundation & Core Modules (Agent)**

**Step 1: Verify & Adapt Starter Template**
    *   **Goal:** Ensure the starter template aligns with project requirements (theme, structure, core libraries, Supabase SSR setup).
    *   **Tasks:**
        *   Verify core dependencies are present (`next`, `react`, `typescript`, `tailwindcss`, `shadcn-ui`, `@supabase/ssr`, `zod`, `react-hook-form`, etc.). Install any missing essentials specifically required by this plan (`nuqs`, `xmlbuilder2`).
        *   Verify Supabase client setup (`src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` or equivalents) is correctly configured using `@supabase/ssr` and environment variables for proper Server/Client component/Server Action/Middleware integration.
        *   Verify basic authentication flow provided by the starter (login, signup, protected routes via middleware) is functional. Note any deviations from standard Supabase auth patterns.
        *   Adapt `src/app/globals.css` and `tailwind.config.js` (or equivalent theme config) to enforce the **strict monochrome theme** (using Shadcn 'neutral' colors as base). Remove or override any conflicting theme setup from the starter.
        *   Confirm ESLint, Prettier, and TypeScript configurations (`.eslintrc.json`, `.prettierrc.json`, `tsconfig.json`) are present and enforce strict rules as per `05-tech-stack-and-patterns.md`.
        *   Adjust the directory structure *if necessary* to align better with `docs/project-overview/01-architecture-layout.md`'s conceptual layout (e.g., ensure logical separation for `actions`, `schemas`, `types`, `components` per domain).
        *   Generate initial Supabase database types: `npx supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/types/supabase.ts` (Request `<your-project-id>` from User if not provided).

**Step 2: Customer Management Module**
    *   **Goal:** Implement core CRUD functionality for customers, including Finvoice-specific fields.
    *   **Tasks:**
        *   Define Customer type (`src/lib/types/customer.types.ts`) including all necessary fields: name, contact info, multiple addresses (type: billing/shipping), and **Finvoice fields (VAT ID/Y-tunnus, OVT/EDI Identifier)**.
        *   Define Zod schema for customer validation (`src/lib/schemas/customer.schema.ts`) covering creation and updates.
        *   Implement Server Actions (`src/lib/actions/customer.actions.ts`) for `createCustomer`, `getCustomerById`, `listCustomers` (with robust pagination/filtering options), `updateCustomer`, `deleteCustomer`. Ensure validation using the Zod schema and compatibility with Supabase RLS (Row Level Security policies should be assumed or basic ones implemented).
        *   Create Customer list page (`src/app/(erp)/customers/page.tsx` - adjust route group if starter uses a different one) using React Server Components (RSC) for data fetching via the `listCustomers` action.
        *   Implement a reusable `CustomerTable` component (`src/components/customers/CustomerTable.tsx`) using Shadcn Table, displaying key customer info. Integrate URL state management (`nuqs`) for pagination, sorting, and filtering directly within the table/page.
        *   Create Add Customer page (`src/app/(erp)/customers/add/page.tsx`) and Edit Customer page (`src/app/(erp)/customers/[id]/edit/page.tsx`).
        *   Implement a reusable `CustomerForm` component (`src/components/customers/CustomerForm.tsx`) using Shadcn Form components, React Hook Form, the Zod schema for validation, and connecting submission to the `createCustomer`/`updateCustomer` Server Actions.
        *   Implement Customer detail view (`src/app/(erp)/customers/[id]/page.tsx`) displaying full customer details and potentially related orders/invoices later.
        *   Write basic unit/integration tests (Vitest/RTL) for Server Actions, form validation, and core component rendering.

**Step 3: Inventory Management Module**
    *   **Goal:** Implement core CRUD for inventory items and basic stock transaction tracking.
    *   **Tasks:**
        *   Define Inventory Item type (`src/lib/types/inventory.types.ts`) including SKU, name, description, **Unit of Measure (UOM, e.g., 'kpl', 'ltr')**, cost price, sales price.
        *   Define Inventory Transaction type (`src/lib/types/inventory.types.ts`) to record stock movements (type: purchase/sale/adjustment, quantity change, timestamp, related item ID).
        *   Define Zod schemas (`src/lib/schemas/inventory.schema.ts`) for item creation/update and potentially stock adjustments.
        *   Implement Server Actions (`src/lib/actions/inventory.actions.ts`) for `createItem`, `getItemById`, `listItems` (with pagination/filtering), `updateItem`, `deleteItem`. Implement `adjustStock` action which creates an `InventoryTransaction` record.
        *   Create Inventory list page (`src/app/(erp)/inventory/page.tsx`) using RSC and `listItems` action.
        *   Implement reusable `InventoryTable` component (`src/components/inventory/InventoryTable.tsx`) with pagination/filtering (`nuqs`).
        *   Create Add Item page (`src/app/(erp)/inventory/add/page.tsx`) and Edit Item page (`src/app/(erp)/inventory/[id]/edit/page.tsx`).
        *   Implement reusable `InventoryItemForm` component (`src/components/inventory/InventoryItemForm.tsx`).
        *   Implement UI for stock adjustments (e.g., a modal invoked from the item list or detail page) linked to the `adjustStock` action.
        *   Consider adding a calculated `quantityOnHand` field (either via DB view/function or calculated within `listItems`/`getItemById` actions based on transactions).
        *   Write tests for actions and form validation.

**Step 4: Order Management Module**
    *   **Goal:** Implement order creation, lifecycle management (including stock checks), and a basic fulfillment view.
    *   **Tasks:**
        *   Define Order and OrderItem types (`src/lib/types/order.types.ts`). Order should include reference to Customer, status, totals. OrderItem should include reference to InventoryItem, quantity, price at time of order.
        *   Define Order Status enum (`src/lib/types/order.types.ts` or constants): `Draft` -> `Confirmed` -> `Processing` (internal steps like Picking/Packing) -> `Shipped` -> `Delivered` -> `Cancelled`.
        *   Define Zod schemas (`src/lib/schemas/order.schema.ts`) for order and order item validation.
        *   Implement Server Actions (`src/lib/actions/order.actions.ts`) for `createOrder`, `getOrderById`, `listOrders`, `addOrderItem`, `removeOrderItem`, `updateOrderItem`. Crucially, implement `updateOrderStatus` which enforces the lifecycle rules. **The transition to `Confirmed` must check current `quantityOnHand` for all line items; fail if insufficient stock, succeed and potentially allocate/decrement stock (or flag for backorder - TBD) if sufficient.**
        *   Create Order list page (`src/app/(erp)/orders/page.tsx`) using RSC and `listOrders` action.
        *   Implement reusable `OrderTable` component (`src/components/orders/OrderTable.tsx`).
        *   Create Add/Edit Order page/form (`src/app/(erp)/orders/add/page.tsx`, `src/app/(erp)/orders/[id]/edit/page.tsx`). This form (`OrderForm`) needs to allow selecting a Customer and adding/editing/removing OrderItems (with Inventory Item lookup/selection, possibly using Shadcn `Combobox` or similar).
        *   Implement Order detail view (`src/app/(erp)/orders/[id]/page.tsx`) showing order details, items, status, and controls for status updates (e.g., 'Confirm Order', 'Mark Shipped' buttons linked to `updateOrderStatus` action).
        *   Create basic Fulfillment view (`src/app/(erp)/fulfillment/page.tsx` or similar route) showing orders in 'Processing' stages (e.g., Confirmed, Picking, Packing, Ready). Implement as a Table or simple Kanban board allowing status updates within the processing stages via `updateOrderStatus`.
        *   Write tests for actions, especially status transition logic and stock checking.

**Step 5: Invoicing Module & Finvoice Export**
    *   **Goal:** Implement invoice generation (from orders and manually), status management, payment recording, and **mandatory Finvoice 3.0 (Netvisor) XML export**.
    *   **Tasks:**
        *   Define Invoice and InvoiceItem types (`src/lib/types/invoice.types.ts`). Invoice needs links to Order (optional) and Customer, status, due date, payment details. InvoiceItem needs link to Product/OrderItem, quantity, price, VAT details.
        *   Define Invoice Status enum (`src/lib/types/invoice.types.ts` or constants): `Draft` -> `Sent` -> `Paid` -> `Overdue` -> `Cancelled`.
        *   Define Zod schemas (`src/lib/schemas/invoice.schema.ts`).
        *   Implement Server Actions (`src/lib/actions/invoice.actions.ts`) for `createInvoiceFromOrder` (populating details from a 'Shipped' Order), `createManualInvoice`, `getInvoiceById`, `listInvoices`, `updateInvoiceStatus` (logic for setting 'Overdue'), `recordPayment`.
        *   Implement Finvoice generation logic in a dedicated service (`src/lib/services/finvoice.service.ts`) using `xmlbuilder2`. This service needs a function (e.g., `generateFinvoiceXml`) that accepts an internal `Invoice` object (and related Customer/Items/Settings data) and returns the complete Finvoice 3.0 XML string, **strictly adhering to the Netvisor import specification**. This requires careful mapping of all required fields (Seller Party from settings, Buyer Party from Customer, line items, VAT calculations, payment terms, bank details, etc.).
        *   Add a Server Action (`generateAndDownloadFinvoice` in `invoice.actions.ts`) that fetches the required invoice data, calls the `finvoice.service`, and returns the XML content appropriately for browser download (e.g., as a `Blob` or data URL with correct headers).
        *   Create Invoice list page (`src/app/(erp)/invoices/page.tsx`) using RSC and `listInvoices` action.
        *   Implement reusable `InvoiceTable` component (`src/components/invoices/InvoiceTable.tsx`).
        *   Create Invoice detail view (`src/app/(erp)/invoices/[id]/page.tsx`) displaying invoice details, items, status, payment history, and the **'Export Finvoice (Netvisor)' button** (enabled for 'Sent' invoices) triggering the download action.
        *   Implement UI for manual invoice creation (`src/app/(erp)/invoices/add/page.tsx` with `InvoiceForm`).
        *   Implement UI for recording payments (e.g., a modal on the detail view) linked to the `recordPayment` action.
        *   Write tests, paying **critical attention to the `finvoice.service` logic** to ensure XML validity and correctness against examples/specs.

**Step 6: Settings & Finalization**
    *   **Goal:** Implement basic settings and finalize the application.
    *   **Tasks:**
        *   Create a Settings page (`src/app/(erp)/settings/page.tsx`).
        *   Implement a form (`SettingsForm`) to capture and save **Seller Party details** required for Finvoice headers (Company Name, VAT ID, OVT, Bank Account IBAN/BIC, Intermediator details). Store these securely (e.g., in a dedicated `settings` table or potentially user/profile metadata if appropriate).
        *   Ensure the `finvoice.service` reads these settings when generating XML.
        *   Create a simple Dashboard overview page (`src/app/(erp)/dashboard/page.tsx`) showing key metrics (optional).
        *   Conduct comprehensive testing (review unit/integration tests, consider manual E2E flows for critical paths like order-to-invoice-to-finvoice).
        *   Perform UI polishing, ensure responsiveness and adherence to the monochrome theme.
        *   Update project README with setup, usage, and deployment instructions.
        *   Prepare for deployment (configure environment variables for production Supabase, check Vercel build settings).

--- --- ---

**Agent Starting Point:** Begin with **Step 1: Verify & Adapt Starter Template** after User completes Phase 0.
