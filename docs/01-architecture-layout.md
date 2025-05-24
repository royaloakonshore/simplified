# Architecture Layout - Simplified ERP System

## 1. Overview

This ERP system utilizes a modern web architecture based on Next.js (App Router), React, TypeScript, and Prisma. It emphasizes server-side rendering (SSR) and React Server Components (RSC) for performance and reduced client-side load, with minimal, targeted use of Client Components for interactivity.

## 2. Technology Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5.x (strict mode)
- **UI Library:** React 18+, Shadcn UI
- **Styling:** Tailwind CSS
- **State Management:** Zustand (minimal use for global UI state if needed), URL State (`nuqs` or similar)
- **Forms:** React Hook Form + Zod
- **Data Fetching/API:** tRPC (client/server)
- **Database ORM:** Prisma
- **Database Hosting:** PostgreSQL (e.g., via Supabase, Neon, local)
- **Authentication:** NextAuth.js (with Prisma Adapter)

## 3. Directory Structure (`/src`)

```
erp-system/
├── .env.local             # Environment variables (Supabase keys, etc.) - MANAGED BY USER
├── .eslintrc.json         # ESLint configuration
├── .gitignore
├── .prettierrc.json       # Prettier configuration
├── components.json        # Shadcn UI configuration
├── next.config.mjs        # Next.js configuration
├── package.json
├── postcss.config.js      # PostCSS configuration (for Tailwind)
├── public/
│   └── ...                # Static assets
├── README.md
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Authentication routes (login, signup)
│   │   │   └── ...
│   │   ├── (main)/        # Main application layout (requires auth)
│   │   │   ├── layout.tsx # Main authenticated layout
│   │   │   ├── dashboard/ # Main dashboard page
│   │   │   │   └── page.tsx
│   │   │   ├── customers/ # Customer management feature
│   │   │   │   └── ...
│   │   │   ├── inventory/ # Inventory management feature
│   │   │   │   └── ...
│   │   │   ├── orders/    # Order management feature
│   │   │   │   └── ...
│   │   │   └── invoices/  # Invoicing feature
│   │   │       └── ...
│   │   ├── api/           # API routes (if needed beyond Server Actions)
│   │   │   └── ...
│   │   ├── favicon.ico
│   │   ├── globals.css    # Global styles (Tailwind base, Shadcn theme)
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Root (landing/public) page
│   ├── components/        # Reusable UI components
│   │   ├── auth/          # Auth-specific components (forms)
│   │   ├── core/          # Core application components (layout, nav)
│   │   ├── forms/         # General form components/wrappers
│   │   ├── icons/         # Icon components
│   │   └── ui/            # Shadcn UI components (auto-generated/customized)
│   ├── lib/               # Core logic, utilities, types, services
│   │   ├── api/           # tRPC API definitions
│   │   │   ├── root.ts      # Root tRPC router
│   │   │   ├── trpc.ts      # tRPC server setup
│   │   │   └── routers/     # Feature-specific routers (e.g., customer.ts)
│   │   ├── constants.ts   # Application-wide constants
│   │   ├── db.ts          # Prisma client instance
│   │   ├── errors.ts      # Custom error types/handling
│   │   ├── hooks/         # Custom React hooks
│   │   ├── schemas/       # Zod validation schemas (organized by feature)
│   │   ├── services/      # Business logic services (e.g., Finvoice)
│   │   │   └── finvoice.service.ts
│   │   ├── store/         # Zustand global state store (if needed)
│   │   ├── trpc/          # tRPC client setup
│   │   │   └── react.tsx    # React Query provider for tRPC
│   │   ├── types/         # Core TypeScript types and interfaces (branded types)
│   │   └── utils.ts       # Utility functions
│   ├── middleware.ts    # Next.js middleware (NextAuth session handling)
│   └── ...              # Other src files as needed
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── tests/                 # Vitest configuration and test setup (Optional top-level)
    └── ...
```

## 4. Component Strategy

- **Server Components First:** Default to Server Components for data fetching and rendering static or server-rendered content.
- **Client Components (`\'use client\'`):** Use only when necessary for interactivity (event handlers, hooks like `useState`, `useEffect`, `useContext`). Keep them small and push state down as much as possible. Fetch data and perform mutations using the tRPC React Query hooks (`@/lib/trpc/react`).
- **Composition:** Build complex UIs by composing smaller, reusable components.
- **Data Fetching:** Primarily via tRPC procedures called from Server or Client Components using the appropriate tRPC client/hooks. Use Suspense for loading states.

## 5. State Management

- **URL State:** Prefer managing UI state like filters, sorting, pagination via URL search parameters (e.g., using `nuqs`).
- **Server Actions:** Replaced by tRPC mutations. Handle mutations and related state updates via tRPC procedures and React Query's cache invalidation/optimistic update capabilities. **[Profile update and order creation flows using tRPC are now confirmed working after addressing `userId` and `firstName` issues.]**
- **Zustand:** Reserve for truly global client-side UI state not easily managed by URL or component state (e.g., notification toasts, sidebar open/closed state). Avoid storing server data fetched via tRPC/React Query in Zustand.

## 6. Error Handling

- **tRPC Procedures:** Throw `TRPCError` for expected errors. Utilize tRPC middleware for centralized error handling/logging if needed.
- **Client Components:** Use React Error Boundaries. Handle tRPC errors using React Query's `onError` callbacks or error states.
- **API Routes:** Standard HTTP error codes and JSON error responses (less common with tRPC).
- **UI:** Display user-friendly error messages (e.g., using Shadcn `Toast`) based on errors from tRPC calls. Log detailed errors.

## 7. Database Design

- See `prisma/schema.prisma` for the database schema.
- Key additions based on recent requirements:
    - `Order` model: Added `orderType` enum (`quotation`, `work_order`). Added `discountAmount`, `discountPercentage` to `OrderItem`.
    - `Invoice` model: Added `vatReverseCharge` boolean. Added `discountAmount`, `discountPercentage` to `InvoiceItem`.
    - `InventoryItem` model: Added `showInPricelist` boolean. **[PENDING: Clarification and schema update for quantity/type distinction - e.g., explicit `quantity` field, `itemType` enum (RAW_MATERIAL, MANUFACTURED_GOOD)]**
    - **New Models:** `BillOfMaterial` and `BillOfMaterialItem` to manage BOM structures. **[PENDING: Schema definition and full implementation]**
- Use Prisma Migrate (`npx prisma migrate dev`) for schema changes.
- **Stock Alerts:** Negative stock levels are permitted but should trigger application-level alerts (mechanism TBD - likely involves querying aggregated transactions).

## 8. Architecture Layout & Project Structure

This document outlines the planned architecture and directory structure for the ERP system. We will leverage a standard Next.js starter template (e.g., `next-ai-starter` or similar) as the foundation, adapting it as needed.

### 8.1. Core Principles

*   **Next.js App Router:** Utilize Server Components (RSC) by default for data fetching and rendering. Client Components (`'use client'`) for interactivity only.
*   **TypeScript:** Strict mode enabled for maximum type safety.
*   **Modular Design:** Components and logic organized by feature/domain.
*   **Prisma ORM:** For database interaction and migrations.
*   **NextAuth.js:** For authentication, configured with Prisma Adapter.
*   **tRPC:** Primary mechanism for API communication (queries and mutations). **[Successfully used to fix profile update and order creation issues.]**
*   **Shadcn UI & Tailwind:** For UI components and styling (monochrome theme).

### 8.2. Expected Directory Structure (Adaptable from Starter)

```
erp-system/
├── .env.local             # Environment variables (Supabase keys, etc.) - MANAGED BY USER
├── .eslintrc.json         # ESLint configuration
├── .gitignore
├── .prettierrc.json       # Prettier configuration
├── components.json        # Shadcn UI configuration
├── next.config.mjs        # Next.js configuration
├── package.json
├── postcss.config.js      # PostCSS configuration (for Tailwind)
├── public/
│   └── ...                # Static assets
├── README.md
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Authentication routes (login, signup)
│   │   │   └── ...
│   │   ├── (main)/        # Main application layout (requires auth)
│   │   │   ├── layout.tsx # Main authenticated layout
│   │   │   ├── dashboard/ # Main dashboard page
│   │   │   │   └── page.tsx
│   │   │   ├── customers/ # Customer management feature
│   │   │   │   └── ...
│   │   │   ├── inventory/ # Inventory management feature
│   │   │   │   └── ...
│   │   │   ├── orders/    # Order management feature
│   │   │   │   └── ...
│   │   │   └── invoices/  # Invoicing feature
│   │   │       └── ...
│   │   ├── api/           # API routes (if needed beyond Server Actions)
│   │   │   └── ...
│   │   ├── favicon.ico
│   │   ├── globals.css    # Global styles (Tailwind base, Shadcn theme)
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Root (landing/public) page
│   ├── components/        # Reusable UI components
│   │   ├── auth/          # Auth-specific components (forms)
│   │   ├── core/          # Core application components (layout, nav)
│   │   ├── forms/         # General form components/wrappers
│   │   ├── icons/         # Icon components
│   │   └── ui/            # Shadcn UI components (auto-generated/customized)
│   ├── lib/               # Core logic, utilities, types, services
│   │   ├── api/           # tRPC API definitions
│   │   │   ├── root.ts      # Root tRPC router
│   │   │   ├── trpc.ts      # tRPC server setup
│   │   │   └── routers/     # Feature-specific routers (e.g., customer.ts)
│   │   ├── constants.ts   # Application-wide constants
│   │   ├── db.ts          # Prisma client instance
│   │   ├── errors.ts      # Custom error types/handling
│   │   ├── hooks/         # Custom React hooks
│   │   ├── schemas/       # Zod validation schemas (organized by feature)
│   │   ├── services/      # Business logic services (e.g., Finvoice)
│   │   │   └── finvoice.service.ts
│   │   ├── store/         # Zustand global state store (if needed)
│   │   ├── trpc/          # tRPC client setup
│   │   │   └── react.tsx    # React Query provider for tRPC
│   │   ├── types/         # Core TypeScript types and interfaces (branded types)
│   │   └── utils.ts       # Utility functions
│   ├── middleware.ts    # Next.js middleware (NextAuth session handling)
│   └── ...              # Other src files as needed
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── tests/                 # Vitest configuration and test setup (Optional top-level)
    └── ...
```

### 8.3. Key Components & Interactions

*   **Root Layout (`src/app/layout.tsx`):** Provides the basic HTML structure, includes global styles and providers (e.g., Toaster).
*   **Auth Layout (`src/app/(auth)/layout.tsx`):** Layout for login/signup pages.
*   **Main Layout (`src/app/(main)/layout.tsx`):** Authenticated layout containing navigation (sidebar/header) and main content area. Manages session via NextAuth.
*   **Feature Routes (e.g., `src/app/(main)/customers/page.tsx`):** Entry points for each major feature, using Server Components for structure and potentially Client Components with tRPC hooks for data display/interaction.
*   **UI Components (`src/components/ui/`, `src/components/core/`):** Shadcn components and custom reusable UI elements.
*   **tRPC Procedures (`src/lib/api/routers/`):** Handle all API logic (queries and mutations), interact with Prisma, perform validation using Zod schemas. Defined within feature-specific routers.
*   **Prisma Client (`src/lib/db.ts`):** Singleton instance of the Prisma client for database access.
*   **Middleware (`src/middleware.ts`):** Handles session management and protects routes using NextAuth middleware helpers.
*   **Zod Schemas (`src/lib/schemas/`):** Define data shapes and validation rules, used in forms and tRPC procedures.
*   **Types (`src/lib/types/`, generated Prisma types):** Define application-specific types and Prisma generated types.
*   **tRPC Client (`src/lib/trpc/react.tsx`):** Sets up the React Query client and provider for consuming tRPC procedures in Client Components.

## 9. Key Feature Implementation Notes

- **Order Types (Quote/Work Order):** `OrderForm.tsx` uses conditional logic based on the `orderType` field (set on creation) to display relevant fields/actions.
- **Discounts:** Implemented in `OrderForm`/`InvoiceForm` line items. Calculation logic ensures amount/percentage consistency. Backend calculates totals *after* discounts.
- **VAT Reverse Charge:** Checkbox in `InvoiceForm`. If true, backend (`invoice.create`/`update`) forces line item VAT to 0 and flags the invoice. Finvoice service (`finvoice.service.ts`) needs specific XML mapping for this flag.
- **Pricelist:** Inventory list view includes filtering logic based on `materialType` and `showInPricelist`. Separate PDF export function uses dedicated tRPC query.
- **BOMs:** Managed via new `/boms` route/components and `bom.ts` tRPC router. Cost calculation performed server-side. **[PENDING: Full implementation of CRUD, linking, and cost calculation]**
- **Inventory Deduction:** Logic within `order.updateStatus` tRPC mutation triggers inventory transactions when status becomes `in_production`. **[CONFIRMED: Basic logic in place for BOM components, needs verification for negative stock handling alerts]**
- **Stock Alerts:** Negative stock is handled by creating standard inventory transactions. A separate mechanism (e.g., dashboard query, dedicated alert table/view) is needed to identify and display items with negative calculated stock or below thresholds. **[Alert display PENDING]**
- **PDF Generation:** Planned strategy is server-side generation (e.g., Puppeteer via tRPC/Inngest) for Invoices and Pricelists. **[PENDING: Implementation for Orders, Invoices, Pricelists. Order PDF generation is a specific upcoming task.]**
- **Finvoice Seller Details Integration:** **[PENDING: Full integration of Company Settings from the database into the Finvoice generation service, replacing placeholder/env var data in `finvoice.service.ts` and related actions/tRPC calls.]**

### Prisma Schema (`prisma/schema.prisma`)

The full schema is maintained in `prisma/schema.prisma`. Key models and recent changes include:

*   **`InventoryItem`**: 
    *   Manages both raw materials and manufactured goods, differentiated by `itemType: ItemType` (enum `RAW_MATERIAL`, `MANUFACTURED_GOOD`). The `materialType` field has been removed.
    *   Stores VAT-exclusive `costPrice` and `salesPrice`.
    *   Links to `BillOfMaterial` (if `itemType` is `MANUFACTURED_GOOD`) via `bom`.
    *   Links to `BillOfMaterialItem` (if used as a component) via `componentInBOMs`.
    *   No longer directly related to `ProductionOrder` models.
*   **`BillOfMaterial`**: Defines components for a manufactured `InventoryItem`.
    *   `manualLaborCost` is VAT-exclusive.
    *   `totalCalculatedCost` (VAT-exclusive) is calculated and stored based on component costs and labor. This calculation occurs on BOM save/update.
*   **`BillOfMaterialItem`**: Links a component `InventoryItem` and its quantity to a `BillOfMaterial`.
*   **`InvoiceItem`**: Represents a line item on an invoice.
    *   `unitPrice` is stored VAT-exclusive.
    *   New fields for profitability tracking (all VAT-exclusive and optional):
        *   `calculatedUnitCost`: The unit cost of the item at the time of invoicing.
        *   `calculatedUnitProfit`: `unitPrice` - `calculatedUnitCost`.
        *   `calculatedLineProfit`: `calculatedUnitProfit` * `quantity` (after discounts).
*   **`Invoice`**:
    *   `totalAmount` stores the **VAT-exclusive sum** of all invoice line net totals.
    *   `totalVatAmount` stores the sum of all invoice line VAT amounts.
    *   The customer-payable gross total is `totalAmount + totalVatAmount`.
*   **Removed Models**: `MaterialType` enum, `ProductionOrder`, `ProductionOrderInput`, `ProductionOrderOutput` have been removed to simplify the production flow, which is now driven by `Order` status.
*   **Multi-tenancy**: `companyId` (currently optional, target non-nullable) links most core entities to a `Company`.

#### Key Calculation Logic & Data Flows

*   **BOM Cost Calculation (`BillOfMaterial.totalCalculatedCost`)**:
    1.  Triggered on `BillOfMaterial` create/update.
    2.  For each `BillOfMaterialItem` in the BOM:
        *   Fetch the component `InventoryItem`'s `costPrice` (VAT-exclusive).
        *   Multiply by `BillOfMaterialItem.quantity`.
    3.  Sum all component line costs.
    4.  Add `BillOfMaterial.manualLaborCost` (VAT-exclusive).
    5.  Store the result in `BillOfMaterial.totalCalculatedCost`.

*   **Invoice Line Profitability (`InvoiceItem` profit fields)**:
    1.  Triggered during `Invoice` creation/finalization (e.g., in `invoiceRouter.create`).
    2.  For each `InvoiceItem`:
        *   Fetch the corresponding `InventoryItem`.
        *   Determine `calculatedUnitCost` (VAT-exclusive):
            *   If `InventoryItem.itemType` is `RAW_MATERIAL`, `calculatedUnitCost` = `InventoryItem.costPrice`.
            *   If `InventoryItem.itemType` is `MANUFACTURED_GOOD`, `calculatedUnitCost` = `InventoryItem.bom.totalCalculatedCost` (cost at time of BOM definition).
        *   `calculatedUnitProfit` = (`InvoiceItem.unitPrice` after line discounts) - `calculatedUnitCost`.
        *   `calculatedLineProfit` = `calculatedUnitProfit` * `InvoiceItem.quantity`.
        *   Store these values in the `InvoiceItem` record.

*   **Invoice Totals (`Invoice` model)**:
    1.  Triggered during `Invoice` creation/finalization.
    2.  For each `InvoiceItem`:
        *   Line Net Total = `InvoiceItem.unitPrice` (VAT-exclusive) * `InvoiceItem.quantity` (after line discounts).
        *   Line VAT = Line Net Total * (`InvoiceItem.vatRatePercent` / 100).
    3.  `Invoice.totalAmount` = Sum of all Line Net Totals.
    4.  `Invoice.totalVatAmount` = Sum of all Line VATs.

*   **Customer Order/Invoice History & Revenue Summary (Customer Detail Page)**:
    1.  User navigates to a customer's detail page.
    2.  Fetch `Customer` data along with related `Order[]` and `Invoice[]` records.
    3.  Display `Order` history (key fields: number, date, status, net total).
    4.  Display `Invoice` history (key fields: number, date, status, net total, VAT amount, gross total).
    5.  Calculate Total Customer Revenue: Sum `Invoice.totalAmount` (net) for invoices with status like 'Paid' or 'Sent'.

### Data Model & Relationships (Illustrative)

Simplified textual representation of key financial and inventory flows:

```
Company (Manages all below)
  |
  +-- User (Belongs to a Company, creates transactions)
  |
  +-- Customer (Belongs to a Company)
  |     |
  |     +-- Order[] (Links to Customer, User)
  |     |     |
  |     |     +-- OrderItem[] (Links to Order, InventoryItem)
  |     |
  |     +-- Invoice[] (Links to Customer, User, optionally Order)
  |           |
  |           +-- InvoiceItem[] (Links to Invoice, InventoryItem)
  |                 (Fields: unitPrice (net), calculatedUnitCost (net), calculatedUnitProfit (net), calculatedLineProfit (net))
  |
  +-- InventoryItem (Belongs to a Company)
  |     (Fields: itemType, costPrice (net), salesPrice (net))
  |     |
  |     +-- (If MANUFACTURED_GOOD) BillOfMaterial? (one-to-one)
  |           (Fields: manualLaborCost (net), totalCalculatedCost (net))
  |           |
  |           +-- BillOfMaterialItem[] (Links to BillOfMaterial, component InventoryItem)
  |
  +-- BillOfMaterial (Belongs to a Company, see above)
  |
  +-- Settings (Company-specific settings, e.g., for Finvoice seller details)
```
