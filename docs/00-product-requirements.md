# Product Requirements Document (PRD) - Simplified ERP

## 1. Introduction

This document outlines the requirements for a simplified, multi-tenant ERP-style SaaS application targeting small businesses. The system integrates Invoicing, Inventory Management (including Bill of Materials), Order Processing (acting as Quotes/Work Orders), Production Workflows, and Customer Registry.

**Current Context & Progress:**
The application has foundational modules for Invoicing, Orders, Inventory, Customers, and basic Settings/User Management. Key features like Finvoice export (partially integrated), order-to-invoice flow, and BOM-driven inventory deduction for production are implemented. Recent efforts focused on stabilizing the build, resolving numerous type errors across the codebase, and ensuring correct VAT handling. Specifically, `InventoryItem.defaultVatRatePercent` is now correctly used, with a fallback to a company-level default VAT rate, when creating invoice line items from an order. The settings page is more robust, handling cases where company settings might not yet exist. SKU handling in orders is now correct. The UI uses shadcn/ui components and a Next.js App Router structure. Authentication is handled by NextAuth. **The `InventoryItem` model and related forms/APIs have been enhanced with `leadTimeDays`, `vendorSku`, `vendorItemName`, and a directly editable `quantityOnHand` field, which correctly generates adjustment transactions.** The build is currently passing after extensive debugging. Type errors in `src/lib/api/routers/invoice.ts` and `src/lib/api/routers/inventory.ts` have been resolved. The immediate next steps involve proceeding with broader feature enhancements and UI completion as outlined.

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
        *   Generate from sales orders (`orderType = WORK_ORDER`). **[Implemented, `INVOICED` status update on order confirmed. `invoiceRouter.createFromOrder` now correctly uses `InventoryItem.defaultVatRatePercent` with fallback to company default VAT.]**
        *   Support for discounts (percentage/amount per line). **[Implemented]**
        *   Automatic calculation of VAT. All user-entered prices and costs are **VAT-exclusive**. `Invoice.totalAmount` is stored NET. `Invoice.totalVatAmount` stores calculated VAT. `InventoryItem.defaultVatRatePercent` is used, with a fallback to a company-level default if the item-specific rate is not set. **[Implemented]**
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
        *   CRUD operations for Inventory Items. **[Implemented - Basic CRUD. `quantityOnHand` is now a directly editable field in the form, and backend logic handles creating adjustment transactions. New fields `leadTimeDays`, `vendorSku`, `vendorItemName` added to schema, form, and tRPC.]**
        *   Categorize items using `itemType` (`RAW_MATERIAL` or `MANUFACTURED_GOOD`). **[Implemented]**
        *   Track SKU, Name, Description, Unit of Measure. **[Implemented, SKU handling in orders is now correct.]**
        *   Store **VAT-exclusive `costPrice`** and **VAT-exclusive `salesPrice`**. **[Implemented]**
        *   `quantityOnHand` is a calculated field based on `InventoryTransaction` records. **[Implemented. The `InventoryItem.quantityOnHand` field now stores the target absolute quantity, and transactions reflect adjustments. The list/getById tRPC calls also calculate and return the actual QOH based on transactions for display consistency, though the direct field on the model is now the primary source for editing.]**
        *   Define Minimum Stock Level and Reorder Level for stock alerts. **[Schema fields exist, alert logic/UI PENDING]**
        *   Support for QR code identifiers on items for quick scanning. **[Implemented, PDF generation for tags exists]**
        *   **NEW REQUIREMENT:** Inventory item `quantityOnHand` should be a single, directly editable field in the item creation/edit forms. Changes will directly update the quantity, triggering necessary `InventoryTransaction` records in the backend. **[Implemented in form and backend.]**
        *   **ENHANCED REQUIREMENT:** Add `InventoryCategory` to Inventory Items. This should be displayed as a column with pill tags in the inventory and pricelist views and allow filtering. `InventoryCategory` model exists; UI needs to display and allow filtering by it. **[PENDING]**
        *   **ENHANCED REQUIREMENT:** Inventory list needs a search bar, and robust client-side or server-side filtering, pagination, and sorting (currently basic tRPC list exists, UI table features need enhancement similar to CustomerTable).
    *   **Replenishment Management (NEW MODULE):**
        *   **Dedicated Replenishment Page:** A separate page under Inventory (`/inventory/replenishment`) specifically for managing raw material replenishment.
        *   **Raw Materials Focus:** Display and manage only items where `itemType === 'RAW_MATERIAL'`.
        *   **Critical Alerts Table:** A compact table at the top showing the most critical reorder needs, sorted by urgency (items below reorder level, out of stock, etc.).
        *   **Bulk Edit Capabilities:** Multi-select functionality for updating `leadTimeDays` and `reorderLevel` fields across multiple items.
        *   **Excel Import/Export for Replenishment:** 
            *   Export current replenishment data to Excel with proper formatting
            *   Import updated Excel files with conservative validation
            *   Focus on replenishment-specific fields: quantities, pricing, lead times, reorder levels
            *   **Data Integrity Safeguards:** Implement strict validation with "are you sure" modals for critical changes
            *   Skip any rows with questionable data rather than risk corruption
            *   Detailed preview of all changes before applying
        *   **Lead Time Management:** The `leadTimeDays` field should be prominently displayed and editable in this module (not in the main inventory table).
    *   **Inventory Transactions:** Record purchases, sales, adjustments (including automated deductions for production). **[Implemented, though UI for manual adjustments may need refinement]**
    *   **Stock Alerts:**
        *   System generates alerts when calculated stock level falls below Minimum Stock Level or Reorder Level. **[PENDING]**
        *   Negative Stock: If production consumes more raw material than available, record the negative transaction but *do not* block the process. Generate a "Negative Stock Alert". **[Implemented logic for negative transactions, alert display PENDING]**
        *   Display alerts prominently (e.g., on dashboard, item pages). **[PENDING]**
    *   **Bill of Materials (BOM):**
        *   Define BOMs for `MANUFACTURED_GOOD` Inventory Items. **[Backend Implemented]**
        *   Link a BOM to one manufactured item. **[Backend Implemented, Optional as per recent update]**
        *   List required component `InventoryItem`s (`RAW_MATERIAL` type) and their quantities. **[Backend Implemented]**
        *   Enter optional **VAT-exclusive `manualLaborCost`** per BOM. **[Backend Implemented]**
        *   System calculates and stores `BillOfMaterial.totalCalculatedCost`. **[Backend Implemented]**
        *   UI for BOM management is **[Partially Implemented - Scaffolding In Progress]**.
        *   **NEW REQUIREMENT (UI Enhancement):** Implement a smoother raw material selection process for BOMs. This should involve displaying the raw material inventory in a table (with minimal columns like Name, SKU, Quantity on Hand), allowing users to select multiple items via checkboxes, and then include them in the BOM with a single action.
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
        *   **NEW REQUIREMENT:** Item and Customer dropdowns in Order and Invoice creation/editing forms should be searchable select components (e.g., using a popover with search).
        *   **NEW REQUIREMENT:** Order table (and Invoice table) should have multi-select checkboxes for rows and bulk action options (e.g., "Print PDF" - can be a placeholder initially if PDF generation is not yet implemented).
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
    *   **NEW REQUIREMENT:** The "Edit" button on customer rows in the Customers table should be changed to a dropdown menu. This dropdown should contain options with icons: "Create Invoice", "Create Quotation", "Create Work Order", and "Edit Customer". These actions should prefill the customer when navigating to the respective forms/pages.
    *   **Customer Order/Invoice History (NEW):**
        *   Customer detail pages must display a history of their associated orders and invoices. **[Backend tRPC procedures exist, UI PENDING]**
        *   Information to include: Order/Invoice Number, Date, Status, Net Total. **[Data available via tRPC]**
        *   Direct links from the history items to the full order/invoice detail page. **[UI PENDING]**
        *   A summary of total net revenue (from paid/sent invoices, **VAT-exclusive**) from the customer should be displayed on their detail page. **[Calculation logic PENDING, UI PENDING]**

### 5. User Management & Settings
    *   **Authentication:** User login with email/password. **[Implemented]**
    *   **User Profile:** Users can update their Name, First Name, and Password. **[Implemented]**
    *   **Company Settings:**
        *   Configure company details for invoicing/Finvoice. **[Implemented, full integration into Finvoice service needs verification/completion for all fields. Settings page now robustly handles cases where settings may not yet exist, guiding user appropriately.]**
        *   Includes company-level default VAT rate. **[Implemented]**

### 6. Reporting & Dashboards
    *   **Dashboard:**
        *   Overview of key metrics (e.g., Overdue Invoices, Orders to Ship, Low Stock Items). **[Basic dashboard page exists with placeholders, actual metric display PENDING]**
        *   Visualizations (charts) if feasible. **[Placeholders exist, actual chart implementation PENDING]**
        *   Date filtering for metrics. **[PENDING]**
    *   **Basic Sales Reports:** (e.g., sales by customer, sales by item). **[PENDING]**
    *   **Inventory Reports:** (e.g., stock levels, stock valuation - based on **VAT-exclusive cost price**). **[PENDING]**
    *   **Profitability Reporting (NEW):** Dashboard views and reports on profit margins (overall, by product, by customer - based on invoiced item profits). **[PENDING]**

**Next Steps (High-Level):**
1.  **Inventory Enhancements (as per new requirements):**
    *   Add editable `quantityOnHand` column to inventory table with quick adjustment mutation. **[PENDING]**
    *   Implement conditional UI hiding for `vendorSku` and `vendorItemName` based on `itemType` in `InventoryItemForm`. **[PENDING]**
    *   Display new fields (`leadTimeDays`, `vendorSku`, `vendorItemName`) in the inventory list table. **[PENDING]**
    *   Add `InventoryCategory` functionality (display as pill tags, enable filtering) to inventory and pricelist views/tables. **[PENDING]**
    *   Enhance inventory table with search, advanced filtering, pagination, and sorting (similar to CustomerTable). **[PENDING]**
2.  **Production Kanban/Table Enhancements:**
    *   Implement BOM information view within Kanban cards/table rows.
3.  **Customer Module Enhancements:**
    *   Change Customer table "Edit" button to a dropdown with actions: Create Invoice, Create Quotation, Create Work Order, Edit Customer (prefilling customer info).
    *   Implement UI for displaying customer order/invoice history and total net revenue.
4.  **Order & Invoice Module Enhancements:**
    *   Implement searchable select dropdowns for Item and Customer selection in Order/Invoice forms.
    *   Add multi-select checkboxes and bulk actions (e.g., Print PDF placeholder) to Order and Invoice tables.
5.  **BOM Management UI:** Develop the user interface for creating and managing Bills of Materials.
6.  **Dashboard Implementation:** Populate the dashboard with actual data and metrics.
7.  **Reporting Features:** Develop basic sales, inventory, and profitability reports.
8.  **PDF Generation:** Implement PDF generation for Invoices, Credit Notes, Orders, and Pricelists.
9.  **Stock Alerts:** Develop UI for displaying stock alerts.
10. **Build Health & TypeScript Health:** Proactively address any new build errors or TypeScript issues that arise. Prioritize a clean `npx tsc --noEmit` and passing `npm run build`. **[Ongoing, significant progress made - build is stable]**
11. **Testing & Refinement:** Thoroughly test all modules and refine UI/UX based on feedback.

## 6. Invoice Management Enhancements

### 6.1. Invoice Actions Consolidation & Enhancements

- **User Story:** As a user, I want to access all relevant actions for an invoice (status changes, export, credit note, copy) from a single dropdown menu, both on the invoice detail page and in the invoice list, so that the interface is cleaner and actions are consistently available.
- **Requirements:**
    - Replace existing "Update Status" and "Record Payment" buttons on `InvoiceDetail.tsx` with a consolidated actions dropdown menu.
    - The single dropdown menu will include:
        - Status transition options (e.g., "Mark as Sent", "Mark as Paid", "Cancel Invoice"). Logic for available transitions based on current status should be maintained.
        - "Create Credit Note" (existing functionality, to be moved into dropdown).
        - "Export Finvoice (XML)" (existing functionality, to be moved into dropdown).
        - "Export as PDF" (new functionality).
        - "Copy Invoice" (new functionality, creates a new draft invoice with details from the current one).
    - Selecting "Mark as Paid" from the dropdown will automatically handle the logic for recording the payment (e.g., setting payment date to today, or prompting if necessary, updating paid amounts). The separate "Record Payment" button/modal will be removed.
    - Implement the same consolidated actions dropdown menu for each row in the Invoices table (`InvoiceListContent.tsx`).
- **Acceptance Criteria:**
    - All listed invoice actions are accessible from the new dropdown on both the detail page and invoice list rows.
    - Setting status to "Paid" correctly updates payment status/date and relevant amounts.
    - "Export as PDF" generates and initiates a download for a PDF representation of the invoice.
    - "Copy Invoice" successfully creates a new draft invoice, pre-filled with data from the source invoice, and preferably navigates the user to the new draft's edit view.
    - The dropdown actions are contextually appropriate (e.g., cannot credit an unsent invoice).

## 7. Order Management Enhancements

### 7.1. Orders Table Improvements

- **User Story:** As a user, I want to see more relevant information in the Orders table, including VAT, order type (quote/work order), and be able to multi-select orders for potential batch actions, so I can manage orders more efficiently.
- **Requirements:**
    - Add a "VAT Amount" column to the Orders table, displaying the total VAT for the order.
    - Add an "Order Type" column displaying a visual pill/tag (e.g., "Quote", "Work Order") based on the order's type.
    - Implement row checkboxes for multi-select functionality in the Orders table.
    - Enable client-side or server-side sorting by "VAT Amount" and "Order Type".
- **Acceptance Criteria:**
    - New "VAT Amount" and "Order Type" columns display correct data for each order.
    - The Order Type pill is visually distinct and accurate.
    - Checkboxes allow selection and deselection of multiple rows.
    - Sorting by "VAT Amount" and "Order Type" functions as expected.

## 8. Inventory & BOM Enhancements

### 8.1. Free Text Tags for Inventory and BOMs

- **User Story:** As a user, I want to add free-text tags to inventory items and Bills of Materials so I can categorize and find them more easily using keywords, including customer-specific identifiers or project codes.
- **Requirements:**
    - Add a `tags` field (persisted as an array of strings) to the `InventoryItem` and `BillOfMaterial` models in the Prisma schema.
    - Update the forms for creating and editing Inventory Items and BOMs to include an input field for managing tags (e.g., a component that allows adding multiple distinct tags).
    - Display assigned tags in the Inventory Item list (e.g., as a new column or within an existing details section per row) and on relevant BOM views.
    - Modify search functionality on the Inventory and BOM list pages to include matching against these tags.
- **Acceptance Criteria:**
    - Users can add, edit, and remove multiple free-text tags for inventory items and BOMs.
    - Tags are displayed clearly on list and detail views.
    - Searching by one or more tags yields correct and relevant results in the respective lists.

### 8.2. Bill of Material (BOM) Variants

- **User Story:** As a user managing manufactured goods, I want to define a product as having variants (e.g., different sizes, colors) and easily create these variants from a template BOM, so I can manage product variations efficiently without recreating BOMs from scratch for each minor difference.
- **Background (Inspired by ERPNext):** ERPNext uses an "Item Template" concept where attributes (like Color, Size) are defined for the template. Variants are then generated based on combinations of these attributes, each becoming a new Item. Each variant can have its own BOM, often copied from a template BOM associated with the template Item and then modified.
- **Requirements:**
    - On an `InventoryItem` of type `MANUFACTURED_GOOD`, add a checkbox: "Has Variants". This designates the item as a "template item".
    - If "Has Variants" is true:
        - A new "Variants" tab or section becomes available on the template item's form/detail view.
        - In this "Variants" section, the user should be able to:
            1.  Define distinguishing attributes for the variants (e.g., Attribute Name: "Color", Attribute Values: "Red, Blue, Green"; Attribute Name: "Size", Values: "S, M, L"). Consider a flexible key-value structure for attributes.
            2.  View a list of already created variant items linked to this template.
            3.  Initiate the creation of a new variant by selecting or inputting specific attribute values.
    - When a new variant is created:
        - A new `InventoryItem` (the "variant item") is created. This item will have `isVariant = true` and will be linked to the `templateItemId` (the ID of the template item). Its specific attributes (e.g., `{"Color": "Red", "Size": "M"}`) should be stored.
        - The system should auto-generate a suggested SKU for the variant (e.g., `templateItemSKU-V1`, `templateItemSKU-RED-M`), allowing the user to edit/override it before saving.
        - A new `BillOfMaterial` is created for this variant item. This BOM's content is initially a copy of the BOM associated with the template `InventoryItem`.
        - The user should be able to easily navigate to edit this new variant-specific BOM to make necessary adjustments.
- **Acceptance Criteria:**
    - The "Has Variants" option can be enabled for manufactured goods.
    - Users can define attributes for product variants on a template item.
    - New variants can be generated, linking them to the template item and storing their specific attributes.
    - Each variant gets its own unique SKU (user-editable, system-suggested).
    - Each variant gets a new BOM, copied from the template's BOM, which can then be independently modified.
    - The system clearly displays the relationship between template items and their variants.

### 8.3. Inventory Data Management via Excel Import/Export

- **User Story:** As a user, I want to export my current inventory list to an Excel file, make bulk changes or add new items in Excel, and then import the file back into the system to update my inventory records, so I can manage large inventory updates efficiently and reduce manual data entry.
- **Requirements (Export):**
    - Provide an "Export to Excel" button on the Inventory List page.
    - The exported `.xlsx` file must include all relevant inventory item fields as columns, with clear, understandable headers corresponding to the system's fields.
    - Data formatting in Excel should be appropriate for the data type (e.g., numbers as numbers, dates as dates, text as text).
- **Requirements (Import):**
    - Provide an "Import from Excel" button on the Inventory List page, allowing users to upload a `.xlsx` file.
    - The system must expect the imported Excel file to follow the same column structure and headers as the exported file. A downloadable template based on the export format should be available.
    - **Matching Logic:** Use SKU as the primary unique key to identify existing inventory items for updates. If an SKU from the import file is not found in the database, the system should treat that row as a new item to be created.
    - **Preview & Confirmation (Crucial Safeguard):**
        - After file upload and initial parsing, the system MUST display a comprehensive preview to the user *before* any database changes are made.
        - This preview should clearly summarize:
            - Number of new items to be created.
            - Number of existing items to be updated, ideally with a visual indication or list of changed fields and their old/new values.
            - Any rows with validation errors (e.g., incorrect data types, missing required fields, invalid values for enumerated types like `ItemType`), along with clear, row-specific error messages.
        - The user must explicitly confirm the changes (e.g., by clicking an "Apply Changes" button) before the system proceeds with database operations. An option to cancel the import must be available.
    - **Data Validation:**
        - Perform robust validation on all imported data against Prisma schema types, Zod schemas (if applicable), and any business rules (e.g., prices must be non-negative, `itemType` must be a valid enum value, required fields must be present).
        - Rows with validation errors should be highlighted in the preview and excluded from the database update process unless corrected by the user (if an interactive correction step is implemented, otherwise they are just reported).
    - **Safeguards & Process:**
        - All database updates resulting from a confirmed import MUST be performed within a single transaction to ensure data integrity (i.e., all changes are applied, or none are if an error occurs mid-process).
        - Provide clear feedback to the user on the success or failure of the import process after confirmation, including a summary of items created/updated and any errors encountered during the final processing.
        - Log all import activities, including the uploaded filename, user performing the import, and a summary of actions taken.
- **Acceptance Criteria:**
    - Inventory can be exported to a well-formatted, comprehensive Excel file.
    - An Excel file adhering to the specified format can be uploaded and parsed.
    - The system correctly identifies new items for creation versus existing items for updates based on SKU.
    - The preview screen accurately and clearly reflects all proposed changes, new items, and data validation errors from the uploaded file.
    - Data is validated against system rules, and only valid, confirmed changes are applied to the database.
    - Database updates are transactional.
    - User receives clear feedback on the outcome of the import process.
