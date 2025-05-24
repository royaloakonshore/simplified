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

## 4. Key Modules & Features

### 4.1. Customer Registry

- **Requirements:**
    - CRUD operations for Customers.
    - Store basic contact information (Name, Email, Phone).
    - Store business identifiers (VAT ID / Y-tunnus).
    - Store e-invoicing details (OVT Identifier, Intermediator Address) for Finvoice compatibility.
    - Manage multiple Addresses (Billing, Shipping).
    - View associated Orders and Invoices for a customer.
- **UI:** Table view with filtering/sorting, Detail view, Create/Edit forms.

### 4.2. Inventory Management

- **Requirements:**
    - CRUD operations for Inventory Items.
    - Categorize items as Raw Material or Manufactured. **[PENDING: UI/Logic for selection and distinction]**
    - Track SKU, Name, Description, Unit of Measure.
    - Track `quantity` for items (e.g., stock level). **[PENDING: Clarify purpose for manufactured items vs. raw materials]**
    - Store Cost Price (for raw materials/manual entry) and Sales Price.
    - Define Minimum Stock Level and Reorder Level for stock alerts.
    - **Pricelist Functionality:**
        - Ability to flag items ("Show in Pricelist" - default true) for inclusion in pricelist views/exports.
        - Filterable Inventory view to show only "Manufactured" items flagged for the pricelist, regardless of quantity.
        - PDF export of the filtered pricelist view.
    - **Inventory Transactions:** Record purchases, sales, adjustments (including automated deductions for production).
    - **Stock Levels:** Current stock levels are determined by calculating the sum of associated `InventoryTransaction` records for each item.
    - **Stock Alerts:**
        - System generates alerts when calculated stock level falls below Minimum Stock Level or Reorder Level.
        - **Negative Stock:** If production consumes more raw material than available, record the negative transaction but *do not* block the process. Generate a specific "Negative Stock Alert".
        - Display alerts prominently (e.g., Dashboard widget, dedicated Inventory Alerts table).
- **UI:** Table view (filterable for Pricelist), Detail view, Create/Edit forms, Transaction log view, Stock Alerts display.

### 4.3. Bill of Materials (BOM) - "Products"

- **Requirements:** **[PENDING: Full BOM module implementation - CRUD, linking, cost calculation]**
    - Define BOMs for "Manufactured" Inventory Items.
    - Link a BOM to one manufactured item.
    - List required component items (Raw Materials) and their quantities.
    - **Cost Calculation:** Automatically calculate the estimated cost of a manufactured item based on the sum of its components' `costPrice` plus a manually entered `manualLaborCost` field on the BOM.
    - Display the manufactured item's `salesPrice` (read-only) for reference.
- **UI:** BOM list view (perhaps linked from Inventory Item detail), Create/Edit form.

### 4.4. Orders (Quotation / Work Order)

- **Requirements:**
    - Unified module for creating Quotations and Work Orders.
    - Select `orderType` (Quotation/Work Order) on creation.
    - Shared sequential numbering (e.g., ORDER-001).
    - **Quotation Specifics:** Display pricing, potential payment info. Hide raw BOM details in line items. Exclude production-specific actions.
    - **Work Order Specifics:** Hide pricing/payment info. Show necessary BOM/component details. Include actions to trigger Production.
    - Link to Customer.
    - Add line items referencing Inventory Items (filtered by "Show in Pricelist").
    - **Line Item Enhancements:** Include columns/fields for Discount Amount and Discount % (mutually calculated).
    - Track Order Status (e.g., Draft, Confirmed, In Production, Shipped, Cancelled - potentially adjusted based on `orderType`). **[PENDING: Review status assignment on creation]**
    - Link to generated Invoice(s).
    - Link to Production workflow.
    - **PDF Export/Print:** Ability to generate a PDF version of the order. **[PENDING]**
- **UI:** Table view (showing `orderType`), Detail view, Create/Edit form (dynamic based on `orderType`).

### 4.5. Production Workflow

- **Requirements:**
    - Visualize Work Orders progressing through production stages.
    - Update Order status based on production progress.
    - **Inventory Deduction:** When an Order status becomes "In Production", automatically deduct the required raw material quantities (based on linked BOMs) from inventory via negative Inventory Transactions.
    - **Simplified View:** Production views (Kanban cards, table rows) should display essential order/customer/item info but *exclude* pricing details.
- **UI:** Kanban board view, potentially Table/Calendar views.

### 4.6. Invoicing

- **Requirements:**
    - Create Invoices manually or from Orders.
    - CRUD operations for Invoices.
    - Sequential Invoice Numbering.
    - Link to Customer and originating Order (optional).
    - Include Invoice Date, Due Date.
    - Track Invoice Status (Draft, Sent, Paid, Overdue, Cancelled, Credited). **[PENDING: Review status assignment on creation]**
    - **Line Item Enhancements:** Include columns/fields for Discount Amount and Discount % (mutually calculated). Include VAT Rate % dropdown (populated with Finnish VAT levels), defaulting from selected item.
    - **VAT Reverse Charge:** Checkbox on Invoice form. If checked, forces all line item VAT rates to 0% and adds explanatory text to the Invoice display/PDF.
    - Calculate Totals (Subtotal, VAT Amount, Grand Total), considering discounts.
    - Record Payments against invoices.
    - **Credit Notes:** Ability to create a Credit Note for an existing Invoice (creates linked invoice with negative amounts, updates original status).
    - **Finvoice Compliance:** Generate Finvoice 3.0 XML exports, correctly mapping customer details, line items, VAT (including reverse charge), and payment information.
    - **PDF Generation:** Generate printable PDF versions of Invoices.
    - Company details for invoicing/Finvoice (Name, VAT ID, Bank Info, Address, Finvoice Intermediator details). **[Partially Implemented: UI for settings exists; PENDING: Full integration into Finvoice generation service]**
- **UI:** Table view, Detail view, Create/Edit form, Payment recording interface.

### 4.7. Dashboard

- **Requirements:**
    - Overview of key metrics (e.g., Overdue Invoices, Orders to Ship, Low Stock Items).
    - Visualizations (charts) if feasible.
    - Date filtering for metrics.

### 4.8. Settings

- **Requirements:**
    - User profile updates (Name, First Name, Password). **[Profile Update for Name and First Name confirmed working]**
    - Company details for invoicing/Finvoice (Name, VAT ID, Bank Info, Address, Finvoice Intermediator details).

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

### 1.  Core Financials & Invoicing
    *   **Invoicing:** Create, send, and manage invoices.
        *   Generate from sales orders or create manually.
        *   Support for discounts (percentage/amount per line).
        *   Automatic calculation of VAT (standard rates, e.g., Finnish VAT). All user-entered prices and costs for items, BOM components, and BOM labor are **VAT-exclusive**.
        *   VAT Reverse Charge mechanism.
        *   Invoice numbering (sequential, customizable prefix).
        *   Track invoice status (Draft, Sent, Paid, Overdue, Cancelled, Credited).
        *   Record payments against invoices.
        *   Credit Note generation from existing invoices.
        *   Finvoice 3.0 XML export (Netvisor compatible).
        *   PDF generation for invoices and credit notes.
    *   **Profitability Tracking (NEW):**
        *   The system must calculate and store profit for each invoiced item.
        *   Profit is defined as (Net Sales Price - Net Unit Cost).
        *   Net Unit Cost is `InventoryItem.costPrice` for raw materials, or the calculated Bill of Material cost for manufactured goods (components' `costPrice`s + `manualLaborCost` from BOM).
        *   All user-entered costs and prices for items, BOM components, and BOM labor are **VAT-exclusive**.
        *   Invoice net totals and line item profits should be available for reporting and dashboard views.

### 2.  Inventory Management
    *   Manage inventory items: raw materials and manufactured goods (`itemType`).
    *   Item details: SKU, name, description, unit of measure, **VAT-exclusive cost price, VAT-exclusive sales price**, stock levels (`quantityOnHand`), supplier info.
    *   Inventory transactions: track purchases, sales, adjustments.
    *   Low stock alerts.
    *   **Bill of Materials (BOM):**
        *   Define BOMs for manufactured goods, linking component items (raw materials) and their quantities.
        *   Include optional **VAT-exclusive manual labor cost** per BOM.
        *   System calculates total BOM cost (sum of component costs + labor cost).
    *   Pricelist generation for selected manufactured goods.
    *   Support for QR code identifiers on items for quick scanning.

### 4.  Customer Relationship Management (CRM)
    *   Manage customer database: contact details, addresses (billing/shipping).
    *   Store customer-specific information for Finvoice (VAT ID, OVT, Intermediator).
    *   **Customer Order/Invoice History (NEW):**
        *   Customer detail pages must display a history of their associated orders and invoices.
        *   Information to include: Order/Invoice Number, Date, Status, Net Total.
        *   Direct links from the history items to the full order/invoice detail page.
        *   A summary of total net revenue (from paid/sent invoices, VAT-exclusive) from the customer should be displayed on their detail page.

### 6.  Reporting & Dashboards
    *   Overview dashboard: key metrics (e.g., sales overview, open orders, due invoices).
    *   Basic sales reports (e.g., sales by customer, sales by item).
    *   Inventory reports (e.g., stock levels, stock valuation - based on **VAT-exclusive cost price**).
    *   **Profitability Reporting (NEW):** Dashboard views and reports on profit margins (overall, by product, by customer - based on invoiced item profits).
