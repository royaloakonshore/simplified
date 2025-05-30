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
