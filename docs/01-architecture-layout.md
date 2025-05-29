# Architecture Layout - Simplified ERP System

## 1. Overview

This ERP system utilizes a modern web architecture based on Next.js (App Router), React, TypeScript, and Prisma. It emphasizes server-side rendering (SSR) and React Server Components (RSC) for performance and reduced client-side load, with minimal, targeted use of Client Components for interactivity.

**Current Context & Progress:**
The system has a stable build with core modules for Invoicing, Orders (Quotes/Work Orders), Inventory, Customers, and basic Settings/User Management implemented. Key functionalities like Finvoice export (partially integrated), order-to-invoice flow, and BOM-driven inventory deduction for production are in place. The UI uses shadcn/ui components and a Next.js App Router structure. Authentication is handled by NextAuth. tRPC is used for API communication, and Prisma for database interactions. Recent work has focused on resolving numerous build errors and type errors across the codebase. `InventoryItem.defaultVatRatePercent` is now correctly used in invoice creation. The project currently passes `npm run build` and `npx tsc --noEmit` shows only two minor 'implicit any' type errors in `src/lib/api/routers/invoice.ts` which need to be addressed.

## 2. Technology Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **UI Library:** React 18+, Shadcn UI
- **Styling:** Tailwind CSS
- **State Management:** Primarily URL State and React Query. Zustand for minimal global UI state (e.g., sidebar).
- **Forms:** React Hook Form + Zod
- **Data Fetching/API:** tRPC (client/server)
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
    - `Order` model: `orderType` enum (`quotation`, `work_order`).
    - `Invoice` model: `vatReverseCharge` boolean. `defaultVatRatePercent` from `InventoryItem` used in calculations when creating invoices from orders. **TODO: Implement company-level default VAT rate as a fallback.**
    - `InventoryItem` model: Uses `itemType: ItemType`. `quantityOnHand` is calculated. `defaultVatRatePercent` field added. **New requirements include making `quantityOnHand` editable during creation/edit and via the inventory table, and adding `InventoryCategory` for filtering.**
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

*   Layouts (`src/app/layout.tsx`, `src/app/(main)/layout.tsx`) manage structure and providers.
*   Feature Routes (e.g., `src/app/(main)/inventory/page.tsx`) use Server Components and tRPC.
*   UI Components (`src/components/`) are built with Shadcn and custom elements.
*   tRPC Procedures (`src/lib/api/routers/`) handle API logic.
*   Middleware (`src/middleware.ts`) handles session management.

## 9. Key Feature Implementation Notes & Next Steps

- **Order Types (Quote/Work Order):** Implemented.
- **Discounts & VAT Reverse Charge (Invoices):** Implemented.
- **Inventory & Pricelist:**
    - Basic inventory list exists. `showInPricelist` flag in schema.
    - **NEXT:** Implement editable `quantityOnHand` in `InventoryItemForm` (for initial stock and adjustments) and directly in the inventory table (with a new tRPC mutation for quick stock adjustment).
    - **NEXT:** Add "Product Category" (`InventoryCategory`) column to the inventory table and enable filtering by it.
    - **NEXT:** Enhance inventory table with a search bar, and robust filtering, pagination, and sorting (similar to `CustomerTable`).
    - **NEXT:** PDF export for pricelist.
- **BOMs:** Backend implemented. **NEXT: UI for BOM management.**
- **Inventory Deduction for Production:** Implemented (when order status changes to `in_production`).
- **Production Kanban/Table:**
    - Basic Kanban view exists, cards link to orders.
    - **NEXT:** Implement a BOM information view (modal/expandable section) within Kanban cards/table rows for manufactured items.
- **Customer History:** tRPC procedures exist. **NEXT: UI for displaying order/invoice history and total net revenue on customer detail page.**
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
1.  **Fix Remaining Type Errors:** Address the 'implicit any' errors in `src/lib/api/routers/invoice.ts`.
2.  **Company Default VAT Rate:** Implement the fallback logic for company-level default VAT rate.
3.  **Inventory Module Enhancements:** Editable quantity, category filtering, advanced table features.
4.  **Production View Enhancements:** BOM display in Kanban/table.
5.  **BOM Management UI.**
6.  **Customer History UI.**
7.  **Dashboard & Reporting Implementation.**
8.  **PDF Generation for key documents.**
9.  **Finalize Finvoice Integration & Credit Note Flow.**
10. **Implement Stock Alert Display.**
11. **Prioritize Build Health:** Maintain passing `npm run build` and clean `npx tsc --noEmit` throughout development.
12. **Comprehensive Testing & UI/UX Refinement.**
