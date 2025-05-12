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
    - Categorize items as Raw Material or Manufactured.
    - Track SKU, Name, Description, Unit of Measure.
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

- **Requirements:**
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
    - Track Order Status (e.g., Draft, Confirmed, In Production, Shipped, Cancelled - potentially adjusted based on `orderType`).
    - Link to generated Invoice(s).
    - Link to Production workflow.
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
    - Track Invoice Status (Draft, Sent, Paid, Overdue, Cancelled, Credited).
    - **Line Item Enhancements:** Include columns/fields for Discount Amount and Discount % (mutually calculated). Include VAT Rate % dropdown (populated with Finnish VAT levels), defaulting from selected item.
    - **VAT Reverse Charge:** Checkbox on Invoice form. If checked, forces all line item VAT rates to 0% and adds explanatory text to the Invoice display/PDF.
    - Calculate Totals (Subtotal, VAT Amount, Grand Total), considering discounts.
    - Record Payments against invoices.
    - **Credit Notes:** Ability to create a Credit Note for an existing Invoice (creates linked invoice with negative amounts, updates original status).
    - **Finvoice Compliance:** Generate Finvoice 3.0 XML exports, correctly mapping customer details, line items, VAT (including reverse charge), and payment information.
    - **PDF Generation:** Generate printable PDF versions of Invoices.
- **UI:** Table view, Detail view, Create/Edit form, Payment recording interface.

### 4.7. Dashboard

- **Requirements:**
    - Overview of key metrics (e.g., Overdue Invoices, Orders to Ship, Low Stock Items).
    - Visualizations (charts) if feasible.
    - Date filtering for metrics.

### 4.8. Settings

- **Requirements:**
    - User profile updates (Name, Password).
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
