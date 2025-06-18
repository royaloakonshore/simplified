# Architecture Layout - Simplified ERP System

## 1. Overview

This ERP system utilizes a modern web architecture based on Next.js (App Router), React, TypeScript, and Prisma. It emphasizes server-side rendering (SSR) and React Server Components (RSC) for performance and reduced client-side load, with minimal, targeted use of Client Components for interactivity.

**Current Context & Progress:**
The system has a stable build with core modules for Invoicing, Orders (Quotes/Work Orders), Inventory, Customers, and basic Settings/User Management implemented. Key functionalities like Finvoice export (partially integrated), order-to-invoice flow, and BOM-driven inventory deduction for production are in place. The UI uses shadcn/ui components and a Next.js App Router structure. Authentication is handled by NextAuth. tRPC is used for API communication, and Prisma for database interactions. 

**Multi-tenancy foundations have been implemented. This includes a many-to-many relationship between Users and Companies (via an implicit `CompanyMemberships` table), an `activeCompanyId` field on the `User` model to manage the current company context, and a `companyProtectedProcedure` in tRPC to ensure data is scoped correctly. Users can switch their active company via a UI component, and Global Admins can create new users (associating them with the admin's active company) and create new companies (becoming a member and setting it as their active company). New tRPC routers (`userRouter`, `companyRouter`) and specific procedures (`user.getMemberCompanies`, `user.setActiveCompany`, `user.createUserInActiveCompany`, `company.create`) support this functionality. The NextAuth session has been updated to include `companyId` reflecting the user's active company.**

**CRITICAL UPDATE: Recent work has focused on resolving all critical TypeScript compilation errors and build issues. Complex React Hook Form type constraint problems in `InventoryItemForm.tsx` have been resolved using explicit type assertions. OrderStatus enum inconsistencies after Prisma client regeneration have been fixed across the codebase. All `@ts-nocheck` workarounds have been removed and proper TypeScript typing implemented. The project now passes `npm run build` and `npx tsc --noEmit` with zero errors. Performance indexes have been deployed providing 60-80% query improvement. **LATEST SESSION UPDATE (2025-01-27): Delivery date column implemented in orders table, production modal enhanced with comprehensive order + BOM details, and navigation structure improved with logical grouping.** The system is stable and ready for continued Phase 2 feature development.**

**MAJOR SESSION UPDATE (2024-12-19): Critical business logic and runtime error fixes have been implemented. The quotation-to-work-order conversion process now properly creates separate work order records while preserving quotation history, maintaining the intended customer order chain (Customer → Quotation → Work Order → Invoice). Prisma Decimal-related runtime errors have been resolved across BOM and Production views using established safe conversion patterns. The `originalQuotationId` relationship has been added to the Order model to enable proper order lineage tracking. All JavaScript runtime errors in production workflows have been eliminated.**

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
    - **Session:** The NextAuth session object (`session.user`) now includes `companyId`, which stores the ID of the user's currently active company. This is populated from the `User.activeCompanyId` during the JWT/session callback.

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

### 7.1. Multi-Tenancy Data Model (NEW SECTION)

To support users belonging to multiple companies and operating within the context of an active company, the following data model changes have been implemented in `prisma/schema.prisma`:

*   **`User` and `Company` Relationship:** A many-to-many relationship is established between the `User` and `Company` models.
    *   This is facilitated by an implicit join table named `_CompanyMemberships` (Prisma default naming) or an explicit one if defined (e.g., `CompanyMember`).
    *   On the `User` model: `memberOfCompanies Company[] @relation("CompanyMembers")`
    *   On the `Company` model: `companyMembers User[] @relation("CompanyMembers")`
*   **Active Company for User:**
    *   The `User` model has an `activeCompanyId` field: `activeCompanyId String?`
    *   This field stores the `id` of the `Company` that the user has currently selected as their active context.
    *   A corresponding relation is defined: `activeCompany Company? @relation("UserActiveCompany", fields: [activeCompanyId], references: [id])`
    *   The `Company` model has a back-relation: `usersWithThisAsActiveCompany User[] @relation("UserActiveCompany")`

These changes allow a single user account to be associated with multiple company tenants and switch between them, with all data operations subsequently scoped to their `activeCompanyId`.

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

### 8.2. Current Project Structure (Detailed File Tree)

```
simplified-erp/
├── 📁 .git/                           # Git version control
├── 📁 .next/                          # Next.js build output
├── 📁 .storybook/                     # Storybook configuration
├── 📁 docs/                           # Project documentation
│   ├── 📄 00-product-requirements.md
│   ├── 📄 01-architecture-layout.md
│   ├── 📄 02-type-flow-and-finvoice.md
│   ├── 📄 03-user-business-flows.md
│   ├── 📄 04-agent-implementation-plan.md
│   ├── 📄 05-tech-stack-and-patterns.md
│   ├── 📄 06-ui-and-feature-roadmap.md
│   ├── 📄 07-enhancement-plan-invoice-order.md
│   ├── 📄 development-journal.md
│   ├── 📄 next-steps-guide.md
│   ├── 📄 performance-optimization-strategy.md
│   └── 📄 README.md
├── 📁 node_modules/                   # Dependencies
├── 📁 prisma/                         # Database schema & migrations
│   ├── 📄 schema.prisma              # Main database schema
│   └── 📁 migrations/                # Database migration files
├── 📁 public/                         # Static assets
├── 📁 screenshots/                    # Project screenshots
├── 📁 scripts/                        # Build and utility scripts
├── 📁 src/                           # Main source code
│   ├── 📁 app/                       # Next.js App Router
│   │   ├── 📄 globals.css            # Global styles
│   │   ├── 📄 layout.tsx             # Root layout
│   │   ├── 📄 page.tsx               # Landing page
│   │   ├── 📄 favicon.ico            # Site favicon
│   │   ├── 📁 (erp)/                 # Main ERP application routes
│   │   │   ├── 📄 layout.tsx         # ERP layout with sidebar
│   │   │   ├── 📁 boms/              # Bill of Materials module
│   │   │   │   ├── 📄 page.tsx       # BOM list page
│   │   │   │   ├── 📁 add/           # Add new BOM
│   │   │   │   ├── 📁 [id]/          # BOM detail/edit pages
│   │   │   │   │   ├── 📄 page.tsx   # BOM detail view
│   │   │   │   │   └── 📁 edit/      # BOM edit page
│   │   │   ├── 📁 customers/         # Customer management module
│   │   │   │   ├── 📄 page.tsx       # Customer list page
│   │   │   │   ├── 📁 add/           # Add new customer
│   │   │   │   └── 📁 [id]/          # Customer detail pages
│   │   │   ├── 📁 dashboard/         # Main dashboard
│   │   │   │   └── 📄 page.tsx       # Dashboard page
│   │   │   ├── 📁 inventory/         # Inventory management module
│   │   │   │   ├── 📄 page.tsx       # Inventory list page
│   │   │   │   ├── 📁 add/           # Add new inventory item
│   │   │   │   ├── 📁 pricelist/     # Pricelist view
│   │   │   │   ├── 📁 replenishment/ # Replenishment management
│   │   │   │   └── 📁 [id]/          # Inventory item detail/edit
│   │   │   ├── 📁 invoices/          # Invoice management module
│   │   │   │   ├── 📄 page.tsx       # Invoice list page
│   │   │   │   ├── 📁 add/           # Create new invoice
│   │   │   │   └── 📁 [id]/          # Invoice detail pages
│   │   │   ├── 📁 orders/            # Order management module
│   │   │   │   ├── 📄 page.tsx       # Order list page
│   │   │   │   ├── 📁 add/           # Create new order
│   │   │   │   └── 📁 [id]/          # Order detail/edit pages
│   │   │   ├── 📁 production/        # Production management
│   │   │   │   └── 📄 page.tsx       # Production Kanban view
│   │   │   ├── 📁 scan/              # QR code scanning
│   │   │   │   └── 📄 page.tsx       # Scan page
│   │   │   └── 📁 settings/          # Application settings
│   │   │       └── 📄 page.tsx       # Settings page
│   │   ├── 📁 api/                   # API routes
│   │   │   ├── 📁 auth/              # NextAuth endpoints
│   │   │   │   └── 📁 [...nextauth]/ # NextAuth configuration
│   │   │   ├── 📁 inngest/           # Inngest webhook endpoint
│   │   │   │   └── 📄 route.ts       # Inngest route handler
│   │   │   ├── 📁 transcribe/        # Speech-to-text API
│   │   │   │   └── 📄 route.ts       # Transcription endpoint
│   │   │   ├── 📁 trpc/              # tRPC API endpoint
│   │   │   │   └── 📁 [trpc]/        # tRPC route handler
│   │   │   └── 📁 upload/            # File upload endpoint
│   │   │       └── 📄 route.ts       # Upload handler
│   │   └── 📁 auth/                  # Authentication pages
│   │       ├── 📄 error/             # Auth error page
│   │       ├── 📄 logout/            # Logout page
│   │       ├── 📄 signin/            # Sign-in page
│   │       ├── 📄 signout/           # Sign-out page
│   │       └── 📄 verify/            # Email verification
│   ├── 📁 components/                # React components
│   │   ├── 📄 AppSidebar.tsx         # Main application sidebar
│   │   ├── 📄 Button.tsx             # Custom button component
│   │   ├── 📄 ClientOnly.tsx         # Client-side only wrapper
│   │   ├── 📄 ClientProvider.tsx     # Client providers wrapper
│   │   ├── 📄 login-form.tsx         # Login form component
│   │   ├── 📄 nav-main.tsx           # Main navigation component
│   │   ├── 📄 nav-projects.tsx       # Projects navigation
│   │   ├── 📄 nav-user.tsx           # User navigation component
│   │   ├── 📄 SpeechToTextArea.tsx   # Speech-to-text component
│   │   ├── 📄 team-switcher.tsx      # Company/team switcher
│   │   ├── 📄 theme-provider.tsx     # Theme context provider
│   │   ├── 📁 boms/                  # BOM-specific components
│   │   │   ├── 📄 BOMForm.tsx        # BOM creation/edit form
│   │   │   └── 📄 BOMTable.tsx       # BOM list table
│   │   ├── 📁 common/                # Shared/common components
│   │   ├── 📁 customers/             # Customer-specific components
│   │   │   ├── 📄 CustomerForm.tsx   # Customer form
│   │   │   ├── 📄 CustomerTable.tsx  # Customer list table
│   │   │   └── 📄 EditCustomerDialog.tsx # Customer edit dialog
│   │   ├── 📁 dashboard/             # Dashboard components
│   │   │   ├── 📄 PlaceholderAreaChart.tsx
│   │   │   ├── 📄 PlaceholderRecentOrdersTable.tsx
│   │   │   └── 📄 PlaceholderReplenishmentTable.tsx
│   │   ├── 📁 forms/                 # Form-related components
│   │   ├── 📁 fulfillment/           # Fulfillment components
│   │   ├── 📁 inventory/             # Inventory-specific components
│   │   │   ├── 📄 InventoryItemForm.tsx # Inventory item form
│   │   │   ├── 📄 InventoryTable.tsx # Inventory list table
│   │   │   └── 📄 PriceListTable.tsx # Price list table
│   │   ├── 📁 invoices/              # Invoice-specific components
│   │   │   ├── 📄 InvoiceDetail.tsx  # Invoice detail view
│   │   │   ├── 📄 InvoiceForm.tsx    # Invoice creation form
│   │   │   ├── 📄 InvoiceSubmissionModal.tsx # Invoice submission
│   │   │   └── 📄 InvoiceTable.tsx   # Invoice list table
│   │   ├── 📁 layout/                # Layout components
│   │   ├── 📁 orders/                # Order-specific components
│   │   │   ├── 📄 EditOrderFormLoader.tsx # Order edit loader
│   │   │   ├── 📄 OrderDetail.tsx    # Order detail view
│   │   │   ├── 📄 OrderForm.tsx      # Order creation form
│   │   │   ├── 📄 OrderStatusUpdateModal.tsx # Status update modal
│   │   │   ├── 📄 OrderSubmissionModal.tsx # Order submission
│   │   │   └── 📄 OrderTable.tsx     # Order list table
│   │   ├── 📁 production/            # Production components
│   │   │   └── 📄 ProductionKanban.tsx # Production Kanban board
│   │   ├── 📁 settings/              # Settings components
│   │   ├── 📁 theme/                 # Theme-related components
│   │   └── 📁 ui/                    # Shadcn UI components
│   │       ├── 📄 alert-dialog.tsx   # Alert dialog component
│   │       ├── 📄 alert.tsx          # Alert component
│   │       ├── 📄 avatar.tsx         # Avatar component
│   │       ├── 📄 badge.tsx          # Badge component
│   │       ├── 📄 breadcrumb.tsx     # Breadcrumb navigation
│   │       ├── 📄 button.tsx         # Button component
│   │       ├── 📄 calendar.tsx       # Calendar component
│   │       ├── 📄 card.tsx           # Card component
│   │       ├── 📄 checkbox.tsx       # Checkbox component
│   │       ├── 📄 collapsible.tsx    # Collapsible component
│   │       ├── 📄 combobox-responsive.tsx # Responsive combobox
│   │       ├── 📄 command.tsx        # Command palette
│   │       ├── 📁 data-table/        # Data table components
│   │       ├── 📄 data-table-faceted-filter.tsx # Table filters
│   │       ├── 📄 data-table-pagination.tsx # Table pagination
│   │       ├── 📄 date-range-picker.tsx # Date range picker
│   │       ├── 📄 dialog.tsx         # Dialog component
│   │       ├── 📄 dropdown-menu.tsx  # Dropdown menu
│   │       ├── 📄 form.tsx           # Form components
│   │       ├── 📄 input.tsx          # Input component
│   │       ├── 📄 kanban.tsx         # Kanban board component
│   │       ├── 📄 label.tsx          # Label component
│   │       ├── 📄 popover.tsx        # Popover component
│   │       ├── 📄 scroll-area.tsx    # Scroll area component
│   │       ├── 📄 select.tsx         # Select component
│   │       ├── 📄 separator.tsx      # Separator component
│   │       ├── 📄 sheet.tsx          # Sheet component
│   │       ├── 📄 sidebar.tsx        # Sidebar component
│   │       ├── 📄 skeleton.tsx       # Loading skeleton
│   │       ├── 📄 sonner.tsx         # Toast notifications
│   │       ├── 📄 table.tsx          # Table component
│   │       ├── 📄 tabs.tsx           # Tabs component
│   │       ├── 📄 textarea.tsx       # Textarea component
│   │       └── 📄 tooltip.tsx        # Tooltip component
│   ├── 📁 contexts/                  # React contexts
│   ├── 📁 hooks/                     # Custom React hooks
│   ├── 📁 lib/                       # Core logic and utilities
│   │   ├── 📄 aiClient.ts            # AI client configuration
│   │   ├── 📄 db.ts                  # Database client
│   │   ├── 📄 inngest.ts             # Inngest configuration
│   │   ├── 📄 storage.ts             # File storage utilities
│   │   ├── 📄 types.ts               # Global type definitions
│   │   ├── 📄 utils.ts               # Utility functions
│   │   ├── 📁 actions/               # Server actions
│   │   │   └── 📄 invoice.actions.ts # Invoice server actions
│   │   ├── 📁 api/                   # tRPC API layer
│   │   │   ├── 📄 root.ts            # Main tRPC router
│   │   │   ├── 📄 trpc.ts            # tRPC configuration
│   │   │   └── 📁 routers/           # Feature-specific routers
│   │   │       ├── 📄 bom.ts         # BOM router
│   │   │       ├── 📄 company.ts     # Company router
│   │   │       ├── 📄 customer.ts    # Customer router
│   │   │       ├── 📄 inventory.ts   # Inventory router
│   │   │       ├── 📄 inventoryCategory.ts # Category router
│   │   │       ├── 📄 invoice.ts     # Invoice router
│   │   │       ├── 📄 order.ts       # Order router
│   │   │       ├── 📄 replenishment.ts # Replenishment router
│   │   │       ├── 📄 settings.ts    # Settings router
│   │   │       └── 📄 user.ts        # User router
│   │   ├── 📁 auth/                  # Authentication logic
│   │   │   └── 📄 index.ts           # NextAuth configuration
│   │   ├── 📁 email/                 # Email utilities
│   │   ├── 📁 schemas/               # Zod validation schemas
│   │   │   ├── 📄 customer.schema.ts # Customer schemas
│   │   │   ├── 📄 inventory.schema.ts # Inventory schemas
│   │   │   ├── 📄 invoice.schema.ts  # Invoice schemas
│   │   │   └── 📄 order.schema.ts    # Order schemas
│   │   ├── 📁 services/              # Business logic services
│   │   │   └── 📄 finvoice.service.ts # Finvoice XML generation
│   │   ├── 📁 supabase/              # Supabase utilities
│   │   │   └── 📄 auth.ts            # Supabase auth helpers
│   │   ├── 📁 trpc/                  # tRPC client setup
│   │   │   ├── 📄 react.tsx          # tRPC React client
│   │   │   └── 📄 server.ts          # tRPC server client
│   │   ├── 📁 types/                 # Type definitions
│   │   │   └── 📄 order.types.ts     # Order type definitions
│   │   └── 📁 zod/                   # Zod utilities
│   ├── 📄 middleware.ts              # Next.js middleware
│   └── 📁 stories/                   # Storybook stories
├── 📄 .cursor-updates                # Development progress log
├── 📄 .cursor-tasks.md               # Task tracking
├── 📄 .cursorrules                   # Cursor AI rules
├── 📄 .eslintrc.json                 # ESLint configuration
├── 📄 .gitignore                     # Git ignore rules
├── 📄 components.json                # Shadcn UI configuration
├── 📄 eslint.config.js               # Modern ESLint config
├── 📄 inngest.config.ts              # Inngest configuration
├── 📄 LICENSE                        # Project license
├── 📄 next-env.d.ts                  # Next.js type definitions
├── 📄 next.config.mjs                # Next.js configuration
├── 📄 next.config.ts                 # TypeScript Next.js config
├── 📄 package.json                   # Dependencies and scripts
├── 📄 package-lock.json              # Dependency lock file
├── 📄 postcss.config.mjs             # PostCSS configuration
├── 📄 readme.md                      # Project README
├── 📄 tailwind.config.ts             # Tailwind CSS configuration
├── 📄 tsconfig.json                  # TypeScript configuration
├── 📄 tsconfig.tsbuildinfo           # TypeScript build cache
└── 📄 vercel.json                    # Vercel deployment config
```

### 8.3. Key Directory Explanations

**📁 `src/app/(erp)/`** - Main ERP application routes using Next.js App Router
- Each subdirectory represents a module (customers, inventory, orders, etc.)
- Follows Next.js file-based routing conventions
- Contains page components, layouts, and nested routes

**📁 `src/components/`** - React components organized by feature
- **`ui/`** - Shadcn UI components and primitives
- **Feature folders** - Module-specific components (customers/, inventory/, etc.)
- **Root level** - Shared components (AppSidebar, team-switcher, etc.)

**📁 `src/lib/api/routers/`** - tRPC API layer
- Each router handles a specific domain (customer, inventory, order, etc.)
- Contains procedures for CRUD operations and business logic
- Uses `companyProtectedProcedure` for multi-tenant data scoping

**📁 `src/lib/schemas/`** - Zod validation schemas
- Input validation for forms and API endpoints
- Type-safe data validation across the application
- Shared schemas for consistent validation

**📁 `prisma/`** - Database schema and migrations
- **`schema.prisma`** - Main database schema definition
- **`migrations/`** - Database migration files for version control

**📁 `docs/`** - Comprehensive project documentation
- Architecture, requirements, implementation plans
- Development journal and progress tracking
- Technical specifications and user flows

## 9. Key Feature Implementation Notes & Next Steps

- **Order Types (Quote/Work Order):** Implemented.
- **Discounts & VAT Reverse Charge (Invoices):** Implemented.
- **Inventory & Pricelist:**
    - Basic inventory list exists. `showInPricelist` flag in schema.
    - **NEXT:** Implement a single, directly editable `quantityOnHand` field in `InventoryItemForm`. **[Form & backend logic DONE.]**
    - **NEXT:** Add "Product Category" (`InventoryCategory`) column to the inventory table and enable filtering by it (displaying categories as pill tags). **[PENDING]**
    - **NEXT:** Enhance inventory table with a search bar, and robust filtering, pagination, and sorting (similar to `CustomerTable`).
    - **NEXT:** PDF export for pricelist.
- **Replenishment Management (NEW MODULE):**
    - **NEXT:** Create dedicated Replenishment page (`/inventory/replenishment`) for raw material management.
    - **NEXT:** Implement critical alerts table showing most urgent reorder needs.
    - **NEXT:** Add bulk edit capabilities for `leadTimeDays` and `reorderLevel` fields.
    - **NEXT:** Implement Excel import/export with conservative validation and data integrity safeguards.
    - **NEXT:** Display `leadTimeDays` and vendor information prominently in replenishment context.
- **BOMs:** Backend implemented. **NEXT: UI for BOM management (Scaffolding in progress: `BOMForm.tsx`, `BOMTable.tsx`, `ComboboxResponsive.tsx` created; new routes under `src/app/(erp)/boms/` exist. `BillOfMaterial.manufacturedItemId` is now optional).**
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
10. **Prioritize Build Health:** Maintain passing `npm run build` and clean `npx tsc --noEmit` throughout development. **[Currently Stable, but with known blockers: linter errors in `InvoiceDetail.tsx` and build error in `boms/[id]/page.tsx`.]**
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

-   **CRUD Operations (`