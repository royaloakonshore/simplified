# Product Requirements Document (PRD) - Simplified ERP

## 1. Introduction

This document outlines the requirements for a simplified, multi-tenant ERP-style SaaS application targeting small businesses. The system integrates Invoicing, Inventory Management (including Bill of Materials), Order Processing (acting as Quotes/Work Orders), Production Workflows, and Customer Registry.

**Current Context & Progress:**
The application has foundational modules for Invoicing, Orders, Inventory, Customers, and basic Settings/User Management. Key features like Finvoice export (partially integrated), order-to-invoice flow, and BOM-driven inventory deduction for production are implemented. Recent efforts focused on stabilizing the build, resolving numerous type errors across the codebase, and ensuring correct VAT handling. Specifically, `InventoryItem.defaultVatRatePercent` is now correctly used when creating invoice line items from an order. The UI uses shadcn/ui components and a Next.js App Router structure. Authentication is handled by NextAuth. The build is currently passing after extensive debugging and `npx prisma generate`. However, `src/lib/api/routers/invoice.ts` still has two minor 'implicit any' type errors that need addressing. The immediate next steps involve fixing these, then proceeding with broader feature enhancements and UI completion.

## 2. Goals

- Provide an intuitive and efficient tool for small businesses to manage core operations.
- Offer seamless data flow between modules (Order -> Production -> Invoice -> Inventory).
- Ensure compliance with relevant standards (e.g., Finvoice for Finnish e-invoicing).
- Build a scalable and maintainable application using modern web technologies.

## 3. Target Audience

- Small manufacturing or service businesses (e.g., ~10 users).
- Businesses needing basic inventory tracking, order processing, and invoicing.
- Users comfortable with standard web applications.

## 5. Non-Functional Requirements

- **Usability:** Intuitive interface, minimal friction for common tasks.
- **Performance:** Responsive UI, reasonably fast data loading and processing.
- **Security:** Secure authentication, proper data authorization (multi-tenancy prep).
- **Maintainability:** Clean, well-documented code following defined standards.
- **Scalability:** Architecture should handle moderate growth in users and data.

## 6. Future Considerations

- Full multi-tenancy implementation (currently prepped for, not fully active).
- Advanced reporting and analytics.
- More complex production scheduling and resource management.
- Direct bank integrations for payment reconciliation.
- Granular user roles and permissions within a company.
- Enhanced dashboard with more dynamic charts and KPIs.

## Key Features & Modules

### 1. Core Financials & Invoicing
    *   **Invoicing:**
        *   Create, send, and manage invoices. **[Implemented]**
        *   Generate from sales orders (`orderType = WORK_ORDER`, status `shipped` or `INVOICED` after creation). **[Implemented, `INVOICED` status update on order confirmed. `invoiceRouter.createFromOrder` now correctly uses `InventoryItem.defaultVatRatePercent`.]**
        *   Support for discounts (percentage/amount per line). **[Implemented]**
        *   Automatic calculation of VAT. All user-entered prices and costs are **VAT-exclusive**. `Invoice.totalAmount` is stored NET. `Invoice.totalVatAmount` stores calculated VAT. `InventoryItem.defaultVatRatePercent` is used. **[Implemented. TODO: Implement company-level default VAT rate as a fallback if `InventoryItem.defaultVatRatePercent` is not set.]**
        *   VAT Reverse Charge mechanism (sets line item VAT to 0%, adds note). **[Implemented]**
        *   Sequential Invoice Numbering (e.g., INV-00001). **[Implemented]** Default status `draft`. **[Implemented]**
        *   Track invoice status (Draft, Sent, Paid, Overdue, Cancelled, Credited). **[Implemented]**
        *   Record Payments against invoices. **[Implemented, UI may need review/enhancement]**
        *   Credit Note generation from existing invoices. **[Backend/Schema prepped, UI/Full Flow PENDING]**
        *   Finvoice 3.0 XML export (Netvisor compatible). **[Implemented, requires full company settings integration]**
        *   PDF generation for invoices and credit notes. **[PENDING]**
    *   **Profitability Tracking (NEW):**
        *   The system calculates and stores profit for each invoiced item in `InvoiceItem` fields (`calculatedUnitCost`, `calculatedUnitProfit`, `calculatedLineProfit`). **[Implemented in backend mutations]**
        *   Profit is defined as (Net Sales Price per unit - Net Unit Cost per unit). **[Implemented]**
        *   Net Unit Cost is `InventoryItem.costPrice` for `RAW_MATERIAL` items, or `BillOfMaterial.totalCalculatedCost` for `MANUFACTURED_GOOD` items. **[Logic in place, needs verification with BOM flow]**
        *   All user-entered costs and prices are **VAT-exclusive**. **[Implemented]**
        *   Invoice net totals and line item profits should be available for reporting and dashboard views. **[Reporting/Dashboard PENDING]**

### 2. Inventory Management & Bill of Materials (BOM)
    *   **Inventory Items:**
        *   CRUD operations for Inventory Items. **[Implemented - Basic CRUD form exists. Quantity editing at creation/edit needs review/implementation.]**
        *   Categorize items using `itemType` (`RAW_MATERIAL` or `MANUFACTURED_GOOD`). **[Implemented]**
        *   Track SKU, Name, Description, Unit of Measure. **[Implemented]**
        *   Store **VAT-exclusive `costPrice`** and **VAT-exclusive `salesPrice`**. **[Implemented]**
        *   `quantityOnHand` is a calculated field based on `InventoryTransaction` records. **[Implemented. Direct editing of quantityOnHand on item table is a NEW REQUIREMENT - See below]**
        *   Define Minimum Stock Level and Reorder Level for stock alerts. **[Schema fields exist, alert logic/UI PENDING]**
        *   Support for QR code identifiers on items for quick scanning. **[Implemented, PDF generation for tags exists]**
        *   **NEW REQUIREMENT:** Inventory item `quantityOnHand` should be editable during item creation (initial stock) and on the item's edit page (as a stock adjustment).
        *   **NEW REQUIREMENT:** The inventory list/table should display `quantityOnHand` as an editable column for quick adjustments. This requires a new tRPC mutation for direct stock adjustment from the table.
        *   **NEW REQUIREMENT:** Inventory list/price list needs a "Product Category" column and filtering by it. `InventoryCategory` model exists, UI needs to display and allow filtering by it.
        *   **NEW REQUIREMENT:** Inventory list needs a search bar, and robust client-side or server-side filtering, pagination, and sorting (currently basic tRPC list exists, UI table features need enhancement similar to CustomerTable).
    *   **Inventory Transactions:** Record purchases, sales, adjustments (including automated deductions for production). **[Implemented, though UI for manual adjustments may need refinement]**
    *   **Stock Alerts:**
        *   System generates alerts when calculated stock level falls below Minimum Stock Level or Reorder Level. **[PENDING]**
        *   Negative Stock: If production consumes more raw material than available, record the negative transaction but *do not* block the process. Generate a "Negative Stock Alert". **[Implemented logic for negative transactions, alert display PENDING]**
        *   Display alerts prominently (e.g., on dashboard, item pages). **[PENDING]**
    *   **Bill of Materials (BOM):**
        *   Define BOMs for `MANUFACTURED_GOOD` Inventory Items. **[Backend Implemented]**
        *   Link a BOM to one manufactured item. **[Backend Implemented]**
        *   List required component `InventoryItem`s (`RAW_MATERIAL` type) and their quantities. **[Backend Implemented]**
        *   Enter optional **VAT-exclusive `manualLaborCost`** per BOM. **[Backend Implemented]**
        *   System calculates and stores `BillOfMaterial.totalCalculatedCost`. **[Backend Implemented]**
        *   UI for BOM management is **[PENDING]**.
    *   **Pricelist Functionality:**
        *   Ability to flag items ("Show in Pricelist" - default true). **[Implemented in schema]**
        *   Filterable Inventory view for pricelist. **[Partially, needs category filter and better table features - see NEW REQUIREMENTS above]**
        *   PDF export of the pricelist. **[PENDING]**

### 3. Orders (Quotation / Work Order) & Production
    *   **Orders:**
        *   Unified module for Quotations and Work Orders, selected by `orderType`. **[Implemented]**
        *   Shared sequential numbering. Default status `draft`. **[Implemented]**
        *   Link to Customer. **[Implemented]**
        *   Add line items referencing `InventoryItem`s. **[Implemented]**
        *   Line Item Discounts: Amount or % (mutually calculated). **[Implemented]**
        *   Track Order Status. **[Implemented]**
        *   Link to generated Invoice(s) and Production workflow. **[Implemented]**
        *   PDF Export/Print for orders. **[PENDING]**
    *   **Quotation Specifics:** Display pricing. Hide raw BOM details. Exclude production actions. **[Logic partially in place via UI, needs hardening]**
    *   **Work Order Specifics:** Hide pricing. Show BOM/component details if applicable. Include actions for Production. **[Logic partially in place via UI, needs hardening]**
    *   **Production Workflow (Simplified - Driven by Order Status):**
        *   Visualize Work Orders progressing (e.g., Kanban). **[Implemented - Basic Kanban exists]**
        *   When an `Order` (type `WORK_ORDER`) status changes to `in_production`:
            *   System identifies `MANUFACTURED_GOOD` items.
            *   For each, it uses their `BillOfMaterial` to create negative `InventoryTransaction` records for the component raw materials, reducing their `quantityOnHand`. **[Implemented]**
        *   Production views exclude pricing. **[Implemented for Kanban]**
        *   **NEW REQUIREMENT:** Ensure orders sent to production create cards in the production Kanban/rows in a table view. These cards/rows should link to the specific order page. **[Kanban card creation is implemented. Linking to order page exists.]**
        *   **NEW REQUIREMENT:** Production Kanban cards/table rows should also contain a BOM information view (e.g., a modal or expandable section showing components and quantities for manufactured items in the order). **[PENDING]**

### 4. Customer Relationship Management (CRM)
    *   Manage customer database: contact details, addresses (billing/shipping). **[Implemented, including CustomerTable with advanced features]**
    *   Store customer-specific information for Finvoice. **[Implemented in schema, UI for edit/view exists]**
    *   Y-tunnus (Finnish Business ID) search and validation. **[Implemented]**
    *   **Customer Order/Invoice History (NEW):**
        *   Customer detail pages must display a history of their associated orders and invoices. **[Backend tRPC procedures exist, UI PENDING]**
        *   Information to include: Order/Invoice Number, Date, Status, Net Total. **[Data available via tRPC]**
        *   Direct links from the history items to the full order/invoice detail page. **[UI PENDING]**
        *   A summary of total net revenue (from paid/sent invoices, **VAT-exclusive**) from the customer should be displayed on their detail page. **[Calculation logic PENDING, UI PENDING]**

### 5. User Management & Settings
    *   **Authentication:** User login with email/password. **[Implemented]**
    *   **User Profile:** Users can update their Name, First Name, and Password. **[Implemented]**
    *   **Company Settings:**
        *   Configure company details for invoicing/Finvoice. **[Implemented, full integration into Finvoice service needs verification/completion for all fields]**

### 6. Reporting & Dashboards
    *   **Dashboard:**
        *   Overview of key metrics (e.g., Overdue Invoices, Orders to Ship, Low Stock Items). **[Basic dashboard page exists with placeholders, actual metric display PENDING]**
        *   Visualizations (charts) if feasible. **[Placeholders exist, actual chart implementation PENDING]**
        *   Date filtering for metrics. **[PENDING]**
    *   **Basic Sales Reports:** (e.g., sales by customer, sales by item). **[PENDING]**
    *   **Inventory Reports:** (e.g., stock levels, stock valuation - based on **VAT-exclusive cost price**). **[PENDING]**
    *   **Profitability Reporting (NEW):** Dashboard views and reports on profit margins (overall, by product, by customer - based on invoiced item profits). **[PENDING]**

**Next Steps (High-Level):**
1.  **Fix Remaining Type Errors:** Address the 'implicit any' errors in `src/lib/api/routers/invoice.ts`.
2.  **Company Default VAT Rate:** Implement the fallback logic for company-level default VAT rate in `invoiceRouter.createFromOrder` and potentially other relevant places.
3.  **Inventory Enhancements (as per new requirements):**
    *   Implement `quantityOnHand` editing in `InventoryItemForm` (creation/edit).
    *   Add editable `quantityOnHand` column to inventory table with quick adjustment mutation.
    *   Add "Product Category" column and filtering to inventory table.
    *   Enhance inventory table with search, advanced filtering, pagination, and sorting.
4.  **Production Kanban/Table Enhancements:**
    *   Implement BOM information view within Kanban cards/table rows.
5.  **Customer History UI:** Implement UI for displaying customer order/invoice history and total net revenue.
6.  **BOM Management UI:** Develop the user interface for creating and managing Bills of Materials.
7.  **Dashboard Implementation:** Populate the dashboard with actual data and metrics.
8.  **Reporting Features:** Develop basic sales, inventory, and profitability reports.
9.  **PDF Generation:** Implement PDF generation for Invoices, Credit Notes, Orders, and Pricelists.
10. **Stock Alerts:** Develop UI for displaying stock alerts.
11. **Build Error Resolution & TypeScript Health:** Proactively address any new build errors or TypeScript issues that arise. Prioritize a clean `npx tsc --noEmit` and passing `npm run build`.
12. **Testing & Refinement:** Thoroughly test all modules and refine UI/UX based on feedback.
