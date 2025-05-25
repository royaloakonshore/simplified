# Product Requirements Document (PRD) - Simplified ERP

## 1. Introduction

This document outlines the requirements for a simplified, multi-tenant ERP-style SaaS application targeting small businesses. The system integrates Invoicing, Inventory Management (including Bill of Materials), Order Processing (acting as Quotes/Work Orders), Production Workflows, and Customer Registry.

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

- Full multi-tenancy implementation.
- Advanced reporting.
- More complex production scheduling.
- Direct bank integrations.
- User roles and permissions within a company.

## Key Features & Modules

### 1. Core Financials & Invoicing
    *   **Invoicing:**
        *   Create, send, and manage invoices.
        *   Generate from sales orders (`orderType = WORK_ORDER`, status `shipped`) or create manually.
        *   Support for discounts (percentage/amount per line).
        *   Automatic calculation of VAT. All user-entered prices and costs for items, BOM components, and BOM labor are **VAT-exclusive**. `Invoice.totalAmount` is stored NET. `Invoice.totalVatAmount` stores calculated VAT.
        *   VAT Reverse Charge mechanism (sets line item VAT to 0%, adds note).
        *   Sequential Invoice Numbering (e.g., INV-00001, customizable prefix planned). Default status `draft`.
        *   Track invoice status (Draft, Sent, Paid, Overdue, Cancelled, Credited).
        *   Record Payments against invoices.
        *   Credit Note generation from existing invoices.
        *   Finvoice 3.0 XML export (Netvisor compatible). **[Company details integration from settings PENDING]**
        *   PDF generation for invoices and credit notes.
    *   **Profitability Tracking (NEW):**
        *   The system calculates and stores profit for each invoiced item in `InvoiceItem` fields (`calculatedUnitCost`, `calculatedUnitProfit`, `calculatedLineProfit`).
        *   Profit is defined as (Net Sales Price per unit - Net Unit Cost per unit).
        *   Net Unit Cost is `InventoryItem.costPrice` for `RAW_MATERIAL` items, or `BillOfMaterial.totalCalculatedCost` for `MANUFACTURED_GOOD` items.
        *   All user-entered costs (inventory item cost, BOM labor cost) and prices (inventory item sales price) are **VAT-exclusive**.
        *   Invoice net totals and line item profits should be available for reporting and dashboard views.

### 2. Inventory Management & Bill of Materials (BOM)
    *   **Inventory Items:**
        *   CRUD operations for Inventory Items.
        *   Categorize items using `itemType` (`RAW_MATERIAL` or `MANUFACTURED_GOOD`).
        *   Track SKU, Name, Description, Unit of Measure.
        *   Store **VAT-exclusive `costPrice`** and **VAT-exclusive `salesPrice`**.
        *   `quantityOnHand` is a calculated field based on `InventoryTransaction` records.
        *   Define Minimum Stock Level and Reorder Level for stock alerts.
        *   Support for QR code identifiers on items for quick scanning.
    *   **Inventory Transactions:** Record purchases, sales, adjustments (including automated deductions for production).
    *   **Stock Alerts:**
        *   System generates alerts when calculated stock level falls below Minimum Stock Level or Reorder Level.
        *   Negative Stock: If production consumes more raw material than available, record the negative transaction but *do not* block the process. Generate a "Negative Stock Alert".
        *   Display alerts prominently.
    *   **Bill of Materials (BOM):** **[Backend Implemented, UI Pending]**
        *   Define BOMs for `MANUFACTURED_GOOD` Inventory Items.
        *   Link a BOM to one manufactured item.
        *   List required component `InventoryItem`s (`RAW_MATERIAL` type) and their quantities.
        *   Enter optional **VAT-exclusive `manualLaborCost`** per BOM.
        *   System calculates and stores `BillOfMaterial.totalCalculatedCost` (sum of components' VAT-exclusive `costPrice` + labor cost).
        *   UI for BOM management is **[PENDING]**.
    *   **Pricelist Functionality:**
        *   Ability to flag items ("Show in Pricelist" - default true).
        *   Filterable Inventory view for pricelist.
        *   PDF export of the pricelist. **[PENDING]**

### 3. Orders (Quotation / Work Order) & Production
    *   **Orders:**
        *   Unified module for Quotations and Work Orders, selected by `orderType`.
        *   Shared sequential numbering (e.g., ORDER-001). Default status `draft`.
        *   Link to Customer.
        *   Add line items referencing `InventoryItem`s (filtered by "Show in Pricelist").
        *   Line Item Discounts: Amount or % (mutually calculated).
        *   Track Order Status (e.g., Draft, Confirmed, In Production, Shipped, Cancelled, Quote Sent, Quote Accepted, Quote Rejected).
        *   Link to generated Invoice(s) and Production workflow.
        *   PDF Export/Print for orders. **[PENDING]**
    *   **Quotation Specifics:** Display pricing. Hide raw BOM details. Exclude production actions.
    *   **Work Order Specifics:** Hide pricing. Show BOM/component details if applicable. Include actions for Production.
    *   **Production Workflow (Simplified - Driven by Order Status):**
        *   Visualize Work Orders progressing (e.g., Kanban).
        *   When an `Order` (type `WORK_ORDER`) status changes to `in_production`:
            *   System identifies `MANUFACTURED_GOOD` items.
            *   For each, it uses their `BillOfMaterial` to create negative `InventoryTransaction` records for the component raw materials, reducing their `quantityOnHand`.
        *   Production views exclude pricing.

### 4. Customer Relationship Management (CRM)
    *   Manage customer database: contact details, addresses (billing/shipping).
    *   Store customer-specific information for Finvoice (VAT ID, OVT Identifier, Intermediator Address).
    *   Y-tunnus (Finnish Business ID) search and validation.
    *   **Customer Order/Invoice History (NEW):**
        *   Customer detail pages must display a history of their associated orders and invoices.
        *   Information to include: Order/Invoice Number, Date, Status, Net Total.
        *   Direct links from the history items to the full order/invoice detail page.
        *   A summary of total net revenue (from paid/sent invoices, **VAT-exclusive**) from the customer should be displayed on their detail page.

### 5. User Management & Settings
    *   **Authentication:** User login with email/password.
    *   **User Profile:** Users can update their Name, First Name, and Password.
    *   **Company Settings:**
        *   Configure company details for invoicing/Finvoice (Name, VAT ID, Bank Info, Address, Finvoice Intermediator details). **[Full integration into Finvoice service PENDING]**

### 6. Reporting & Dashboards
    *   **Dashboard:**
        *   Overview of key metrics (e.g., Overdue Invoices, Orders to Ship, Low Stock Items).
        *   Visualizations (charts) if feasible.
        *   Date filtering for metrics.
    *   **Basic Sales Reports:** (e.g., sales by customer, sales by item). **[PENDING]**
    *   **Inventory Reports:** (e.g., stock levels, stock valuation - based on **VAT-exclusive cost price**). **[PENDING]**
    *   **Profitability Reporting (NEW):** Dashboard views and reports on profit margins (overall, by product, by customer - based on invoiced item profits). **[PENDING]**
