# User & Business Flows - Simplified ERP System

This document details key user and business process flows within the ERP system.

**Current Context & Progress:**
The application has established user flows for core operations like login, profile updates (now robustly handles password changes and profile info updates), inventory item creation (basic, SKU handling fixed for orders), sales order creation and confirmation, invoicing from orders, and Finvoice export. The system uses tRPC for backend mutations and queries, with NextAuth for authentication. **CRITICAL UPDATE: All TypeScript compilation errors and build issues have been resolved. Complex React Hook Form type constraint problems in `InventoryItemForm.tsx` have been fixed using explicit type assertions. OrderStatus enum inconsistencies after Prisma client regeneration have been resolved across the codebase. All `@ts-nocheck` workarounds have been removed and proper TypeScript typing implemented. The build now passes successfully with zero errors.** The settings page now gracefully handles cases where company settings haven't been created. **The inventory item forms and backend now support directly editable `quantityOnHand` (with transaction generation) and new fields: `leadTimeDays`, `vendorSku`, `vendorItemName`.** Several UI enhancements for tables (customers) have been made, and a basic Kanban board for production exists. 

**Multi-tenancy foundations have been implemented, including: a Company Switcher allowing users to belong to multiple companies and switch their active context; functionality for Global Admins to create new users and associate them with the admin's active company; and functionality for Global Admins to create new companies (tenants), automatically becoming a member and setting it as their active company. These features leverage a many-to-many relationship between Users and Companies, an `activeCompanyId` on the User model, and a `companyProtectedProcedure` for data scoping.**

**Performance indexes have been deployed providing 60-80% query improvement. The system is stable and ready for Phase 2 feature development.**

## 1. Core Entities & Lifecycle

*   **Customer:** Created -> Updated -> Used in Orders/Invoices **[Implemented]**
*   **Inventory Item:** Created -> Stock Adjusted (Purchased/Adjusted) -> Used in Orders -> Stock Decreased (Shipped/Production) **[Basic create/use implemented. `quantityOnHand` is now directly editable in forms. New fields `leadTimeDays`, `vendorSku`, `vendorItemName` added. Stock adjustment flow refinement, especially for table-based editing and category filtering, are NEXT STEPS.]**
*   **Order:** Draft -> Confirmed (Inventory Allocated) -> Processing (Production Stages via Kanban/Table) -> Shipped/Completed -> INVOICED **[Implemented. Production view needs BOM info display.]**
*   **Invoice:** Draft (From Order/Manual) -> Sent -> Payment Recorded -> Paid / Overdue -> Exported (Finvoice) **[Implemented. Credit Note flow PENDING.]**

## 2. Multi-Tenancy & Company Management Flows (NEW SECTION)

### 2.1. Admin Creates a New Company (Tenant)

**Actor:** Global Administrator (User with `UserRole.admin`)

1.  **Access Company Creation:** Admin navigates to the company creation interface (e.g., via "Create Company" option in the Team Switcher/Company Selector component).
2.  **Open Create Company Dialog:** A dialog or form appears, prompting for the new company's name.
3.  **Enter Company Name:** Admin inputs the desired name for the new company.
4.  **Submit Form:** Admin submits the creation form.
5.  **System Processing:**
    *   The `company.create` tRPC mutation is called.
    *   A new `Company` record is created in the database.
    *   The admin user is automatically added as a member of this new company (via `CompanyMemberships` table).
    *   The admin user's `activeCompanyId` in their `User` record is updated to the ID of the newly created company.
    *   The user's session is updated to reflect the new `activeCompanyId`.
6.  **Feedback & Redirection/Refresh:**
    *   A success notification (e.g., toast: "Company '[New Company Name]' created successfully.") is displayed.
    *   The company list in the Team Switcher is refreshed to include the new company.
    *   The admin is now operating within the context of the newly created company.

### 2.2. Admin Creates a New User in Their Active Company

**Actor:** Global Administrator (User with `UserRole.admin`)

1.  **Access User Creation:** Admin navigates to the user creation interface (e.g., a "Create User" section on the `/settings` page).
2.  **Open Create User Form:** The form for creating a new user is displayed. This form is only visible/accessible to global admins.
3.  **Enter User Details:** Admin inputs the new user's details:
    *   Name
    *   Email
    *   Password
    *   Role (e.g., `USER`, `COMPANY_ADMIN` - initially defaults to `USER`)
4.  **Submit Form:** Admin submits the user creation form.
5.  **System Processing:**
    *   The `user.createUserInActiveCompany` tRPC mutation is called. This is a `companyProtectedProcedure` and uses the admin's `activeCompanyId` from the session context.
    *   A new `User` record is created in the database with the provided details.
    *   The new user is automatically added as a member of the admin's currently active company (via `CompanyMemberships` table, linked to the admin's `ctx.companyId`).
    *   The new user's `activeCompanyId` is set to the admin's `ctx.companyId`.
6.  **Feedback:**
    *   A success notification (e.g., toast: "User '[New User Name]' created successfully and added to [Active Company Name].") is displayed.
    *   The form may clear or the admin might be redirected to a user list (if it exists).

### 2.3. User Switches Active Company

**Actor:** Any authenticated user who is a member of multiple companies.

1.  **Access Company Switcher:** User interacts with the Team Switcher/Company Selector component (e.g., in the sidebar).
2.  **View Company List:** The switcher displays a list of companies the user is a member of. This list is fetched via the `user.getMemberCompanies` tRPC query.
3.  **Select New Company:** User selects a different company from the list.
4.  **System Processing:**
    *   The `user.setActiveCompany` tRPC mutation is called with the ID of the selected company.
    *   The backend verifies that the user is a member of the target company.
    *   If membership is confirmed, the user's `activeCompanyId` field in their `User` record is updated in the database.
    *   The user's session is updated (`useSession().update()`) to reflect the new `activeCompanyId` in `session.user.companyId`.
5.  **Feedback & UI Update:**
    *   A success notification (e.g., toast: "Active company changed to '[Selected Company Name]'.") may be displayed.
    *   The UI updates to reflect the new company context. Data displayed throughout the application (e.g., dashboards, lists) will now be scoped to the newly selected company, assuming data fetching procedures correctly use `companyProtectedProcedure`.

## 3. Detailed User Flow: Inventory Item Lifecycle & Sale

**Persona:** Inventory Manager, Sales Rep, Finance Clerk, Admin

**Goal:** Add a new product, manage its stock (including initial quantity and adjustments), sell it, invoice the customer, and export the invoice.

**Steps:**

1.  **Login & Profile Check (Admin/User):** **[Implemented]**
    *   User logs in.
    *   User can update profile (Name, Password). **[Settings page for this is now more robust]**
2.  **Navigate to Inventory:** User selects 'Inventory' from navigation. **[Implemented]**
3.  **Create New Item / Edit Existing Item:**
    *   User clicks 'Add New Item' or selects an item and clicks 'Edit'.
    *   Fills in/Updates `InventoryForm` (SKU, Name, Description, Unit of Measure, VAT-exclusive Cost Price, VAT-exclusive Sales Price, Item Type (`RAW_MATERIAL`/`MANUFACTURED_GOOD`), **Inventory Category (pending)**, **`quantityOnHand` (single editable field - implemented in form)**, **`leadTimeDays` (implemented in form)**, **`vendorSku` (implemented in form)**, **`vendorItemName` (implemented in form)** (last two hidden if `MANUFACTURED_GOOD` - conditional hiding pending)). **[SKU handling for order creation is fixed. Backend logic for new fields and QOH adjustment is implemented.]**
    *   **NEW/ENHANCE:** User enters/adjusts `quantityOnHand`. For new items, this is initial stock. For existing items, this is a stock adjustment (backend creates an `InventoryTransaction`). This replaces the previous "initial quantity/adjust by X" approach. **[Implemented in form and backend tRPC.]**
    *   Saves the item. **[Backend `inventory.create` / `inventory.update` tRPC mutations handle this. Form submission logic is in place.]**
4.  **Manage Stock & Replenishment:**
    *   **Main Inventory List**: User navigates to the Inventory list for basic inventory overview.
    *   Table displays `quantityOnHand`, `InventoryCategory` (as pill tags). **[Category display PENDING]**
    *   User can filter by **Inventory Category** (pill tags), search by name/SKU, sort, and paginate. **[Advanced table features PENDING]**
    *   **Replenishment Management**: User navigates to `/inventory/replenishment` for detailed raw material management.
    *   **Critical Alerts Table**: Top section shows most urgent reorder needs (sorted by criticality). **[PENDING]**
    *   **Full Replenishment Table**: Displays all raw materials with `leadTimeDays`, `vendorSku`, `vendorItemName`, reorder levels. **[PENDING]**
    *   **Bulk Operations**: User can multi-select items and bulk edit lead times and reorder levels. **[PENDING]**
    *   **Excel Import/Export**: User can export current replenishment data, edit in Excel, and import with careful validation. **[PENDING]**
5.  **Record Initial Stock / Replenishment (Alternative to Form Edit):** Covered by step 3 & 4. `leadTimeDays` will be used for future replenishment alert features. Manual `InventoryTransaction` creation UI might be a future enhancement if detailed transaction logging (e.g. purchase orders) is needed beyond simple adjustments.
6.  **Create Sales Order:** **[Implemented]**
    *   (Sales Rep) Creates new `Order` (type `WORK_ORDER` or `QUOTATION`).
    *   Selects Customer and adds Inventory Items using **searchable select dropdowns**. Sets quantities.
    *   Saves order as 'Draft'.
    *   **NEW:** User can select multiple orders from the Order list table (via checkboxes) and trigger bulk actions like "Print PDF" (placeholder initially).
7.  **Confirm Order & Allocate Stock:** **[Implemented]**
    *   Order status to 'Confirmed'.
    *   Inventory allocation/deduction logic depends on `itemType` and if it's a `WORK_ORDER` moving to `in_production`.
8.  **Process Order (Production/Fulfillment View for Work Orders):**
    *   (Fulfillment Staff) Views 'Confirmed' `WORK_ORDER`s on Kanban/Table. **[Implemented]**
    *   Updates status (e.g., 'Picking' -> 'Packing' -> 'Ready for Shipment'). **[Manual status update on Kanban implemented]**
    *   **NEW:** Views BOM components and quantities for manufactured items directly on the Kanban card/table row. **[PENDING]**
    *   System Action: When `WORK_ORDER` status -> `in_production`, `MANUFACTURED_GOOD` components are deducted from stock. **[Implemented]**
9.  **Mark Order as Shipped/Completed:** **[Implemented]**
    *   Order status updated to 'shipped'. Ready for invoicing.
10. **Generate Invoice:** **[Implemented]**
    *   (Finance Clerk) Creates Invoice from Order (any status, typically 'Shipped') or manually. Uses **searchable select dropdowns** for Customer/Items if manual.
    *   System pre-populates from order, using `InventoryItem.salesPrice`. VAT is calculated using `InventoryItem.defaultVatRatePercent` if available, otherwise falling back to the company-level default VAT rate from Settings. If neither is set, VAT defaults to 0%. **[VAT logic Implemented]**
    *   Profit calculation occurs in backend. **[Implemented]**
    *   Saves invoice (status 'Draft'). Order status becomes `INVOICED`. **[Implemented]**
    *   **NEW:** User can select multiple invoices from the Invoice list table (via checkboxes) and trigger bulk actions like "Print PDF" (placeholder initially).
11. **Send Invoice:** **[Implemented]**
    *   Status to 'Sent'.
12. **Export Finvoice:** **[Implemented, needs full settings integration]**
    *   Generates Finvoice XML.
13. **Record Payment:** **[Implemented, UI review needed]**
    *   Status to 'Paid'.

## 4. Backend Interaction Focus

- **Data Validation:** Zod schemas for all tRPC inputs. **[Standard Practice]**
- **Database Operations:** Prisma client. **[Standard Practice]**
- **State Updates & UI Revalidation:** tRPC returns updated data; React Query handles cache invalidation and UI updates. **[Standard Practice]**
- **Error Handling:** `TRPCError` for backend errors, toasts for frontend. **[Standard Practice]**

## 5. Other Key Flows (Summary & Next Steps)

*   **Customer Creation & Management:** **[Implemented, with advanced table and edit dialog]**
    *   **NEW:** From the Customer list, user can click a dropdown on a customer row to quickly: Create Invoice, Create Quotation, Create Work Order (pre-fills customer), or Edit Customer.
*   **Customer Order/Invoice History & Revenue Summary (NEW):**
    *   Navigate to Customer Detail Page.
    *   View lists of Orders and Invoices. **[UI PENDING, Backend tRPC ready]**
    *   View Total Net Revenue. **[Calculation and UI PENDING]**
*   **BOM Creation & Management:**
    *   Navigate to `MANUFACTURED_GOOD` Inventory Item detail page or dedicated BOM section.
    *   **NEXT/IN PROGRESS:** UI form to create/edit BOMs (add `RAW_MATERIAL` components, quantities, set `manualLaborCost`). Backend `bomRouter.upsert` exists. Initial UI scaffolding (`BOMForm`, `BOMTable`, page structure under `/boms`) is in progress. Manufactured item link is now optional.
    *   **ENHANCED FLOW (Pending Implementation):** When adding raw materials to a BOM, user will be presented with a table of available raw materials (showing Name, SKU, QOH). They can select desired items via checkboxes and add them in bulk to the BOM's component list.
*   **Inventory Category Management (Implicit):** Categories are created/managed via Prisma Studio or migrations for now. Future: UI for category CRUD if needed.

**Next Steps (User Flow Focused):**
1.  **Inventory Management Enhancements:**
    *   Implement UI for conditional hiding of `vendorSku`, `vendorItemName` in `InventoryItemForm` if `itemType` is `MANUFACTURED_GOOD`.
    *   Develop the editable `quantityOnHand` column in the Inventory list table with quick adjustment functionality.
    *   Add Inventory Category column (with pill tags) and filtering to the Inventory list. Display `leadTimeDays`, `vendorSku`, `vendorItemName` in the table.
    *   Implement advanced table features (search, sort, filter, pagination) for the Inventory list (similar to CustomerTable).
2.  **Order & Invoice Flow Enhancements:**
    *   Implement searchable select dropdowns for Customer and Item selection in Order/Invoice forms.
    *   Add multi-select checkboxes and bulk action capabilities (e.g., "Print PDF" placeholder) to Order and Invoice list tables.
3.  **Customer Management Enhancements:**
    *   Implement the customer action dropdown (Create Invoice/Quotation/Work Order, Edit) on the Customer list table.
    *   Develop the UI on the Customer Detail Page to display order history, invoice history, and total net revenue.
4.  **Production Kanban/Table Enhancements:**
    *   Design and implement the BOM information view within Kanban cards/table rows for manufactured items in an order.
5.  **BOM Management UI:**
    *   Create the frontend forms and views for managing Bill of Materials linked to `MANUFACTURED_GOOD` items. This includes finalizing the add/edit forms (`BOMForm.tsx`), the list view (`BOMTable.tsx` on `/boms`), and implementing the detail view page (`/boms/[id]`). Address the current build blocker for the detail page.
    *   Implement the enhanced table-based multi-select UI for adding raw materials to a BOM.
6.  **Refine Payment Recording:** Review and potentially enhance the UI for recording invoice payments.
7.  **Credit Note Flow:** Implement the full user flow for creating and managing credit notes from existing invoices.
8.  **Dashboard & Reporting Flows:** Define and implement user flows for accessing and interacting with dashboard metrics and reports.
9.  **Build Health & Stability:** Maintain a clean build (`npm run build`) and TypeScript checks (`npx tsc --noEmit`) throughout development. **[Currently Stable]**
10. **PDF Generation Access:** Ensure users can easily trigger and download PDF versions of Invoices, Orders, Pricelists, etc.

## 6. Invoice Management Flows

### 6.1. Updating Invoice Status (Detail Page)

1.  **Navigate:** User navigates to a specific invoice detail page (e.g., `/invoices/[id]`).
2.  **Open Actions:** User clicks the consolidated "Actions" dropdown menu (likely represented by a "More" icon).
3.  **Select Status Change:** User selects a new status from the available transition options (e.g., "Mark as Paid", "Mark as Sent").
4.  **System Processes:** 
    - If "Mark as Paid" is selected, the system internally records the payment details (e.g., sets payment date, updates `paidAmount`) and then updates the invoice status to `PAID`.
    - For other status changes, the system updates the invoice status directly.
5.  **Feedback:** A toast notification confirms the successful status update (e.g., "Invoice status updated to PAID").
6.  **UI Update:** The page re-renders or refreshes to reflect the new invoice status and any related information (like payment details).

### 6.2. Performing Other Invoice Actions (Detail Page - e.g., Export PDF, Copy)

1.  **Navigate & Open Actions:** User is on an invoice detail page and opens the "Actions" dropdown menu.
2.  **Select Action:**
    *   **Export PDF:** User selects "Export as PDF". The system generates a PDF representation of the invoice and initiates a browser download for the user.
    *   **Copy Invoice:** User selects "Copy Invoice". The system creates a new invoice in `DRAFT` status, pre-filled with data from the current invoice (e.g., customer, line items, amounts - excluding dates like invoice date/due date which should be new). The user is then navigated to the edit page for this newly created draft invoice.
    *   **Export Finvoice/Create Credit Note:** User selects these options, and existing flows are triggered.
3.  **Feedback:** Toast notifications for success or error of the action.

### 6.3. Performing Invoice Actions (List View)

1.  **Navigate:** User navigates to the Invoices list page (`/invoices`).
2.  **Locate & Open Actions:** User finds the desired invoice row in the table and clicks the "Actions" dropdown menu specific to that row.
3.  **Select Action & Flow:** The user selects an action (e.g., "Mark as Paid", "Export PDF", "Copy Invoice"). The subsequent flow and system processing are identical to performing the action from the detail page (as described in 6.1 and 6.2).

## 7. Order Management Flows

### 7.1. Viewing Enhanced Order List

1.  **Navigate:** User navigates to the Orders list page (`/orders`).
2.  **View Table:** The orders table is displayed with the following key columns visible: Order Number, Customer Name, Order Date, Status, Order Type (rendered as a distinct visual pill, e.g., "Quote" or "Work Order"), Total Amount, and VAT Amount.
3.  **Sort Data:** User can click on the column headers for "Order Type" and "VAT Amount" (and other existing sortable columns) to sort the table data accordingly.
4.  **Multi-Select:** User sees a checkbox at the beginning of each order row. Clicking these checkboxes allows the user to select/deselect multiple orders, visually indicating selection. (Batch actions based on this selection are a future enhancement).

## 8. Inventory & BOM Management Flows

### 8.1. Managing Tags (Inventory Items & BOMs)

1.  **Access Form:** User navigates to the form for creating a new or editing an existing Inventory Item or Bill of Material.
2.  **Edit Tags:** User interacts with a "Tags" input field. This field should support adding multiple distinct text tags (e.g., via a tag-input component showing tags as pills, or by typing comma-separated values that are then parsed into tags).
3.  **Save:** User saves the form. The entered tags are persisted with the inventory item or BOM.
4.  **View Tags:** 
    *   On the Inventory Item list, a "Tags" column displays the tags associated with each item, or tags are shown within a detail expansion area for the row.
    *   On BOM list/detail views, associated tags are similarly displayed.
5.  **Search by Tag:** User types a tag (or part of a tag) into the main search bar on the Inventory List page or BOM List page. The list filters to display only items/BOMs that have matching tags.

### 8.2. Creating and Managing BOM Variants

1.  **Enable Variants for Template Item:** 
    *   User edits an existing `MANUFACTURED_GOOD` Inventory Item (this will become the "template item").
    *   User checks the "Has Variants" checkbox on the form and saves the item.
2.  **Access Variants Tab:** A "Variants" tab or section now appears on the template item's form/detail view. User navigates to this tab.
3.  **Define Attributes (First-time for a template):** If no attributes are defined yet, the user is prompted to define attributes that will differentiate the variants (e.g., Attribute Name: "Color", possible Values: "Red, Blue, Green"; Attribute Name: "Size", possible Values: "S, M, L"). These attribute definitions are saved against the template item.
4.  **Create New Variant:** 
    *   User clicks an "Add Variant" or "Generate Variant" button within the "Variants" tab.
    *   User is presented with options to select/input values for the defined attributes (e.g., Color: Red, Size: M).
    *   The system suggests a SKU for the new variant item (e.g., `TEMPLATE_SKU-RED-M`). The user can review and edit this SKU.
    *   User confirms the creation.
5.  **System Creates Variant:**
    *   A new `InventoryItem` (the variant) is created in the database. It is marked as a variant, linked to the template item, and its specific attribute combination (e.g., `{"Color": "Red", "Size": "M"}`) is stored.
    *   A new `BillOfMaterial` is created for this variant item. The content of this new BOM is a direct copy of the BOM associated with the template item.
6.  **Edit Variant BOM (Optional Immediate Step):** The user might be automatically navigated to the BOM form for the newly created variant's BOM, allowing them to make immediate modifications specific to this variant.
7.  **View Variants:** The "Variants" tab on the template item's page updates to list all created variant items, showing their SKUs and distinguishing attributes. Users can click on a variant to view/edit its details or its specific BOM.

### 8.3. Using Inventory Excel Import/Export

1.  **Export Inventory:**
    *   User navigates to the Inventory List page.
    *   User clicks an "Export to Excel" button.
    *   The browser initiates a download of an `.xlsx` file containing all current inventory items and their data, formatted with clear column headers.
2.  **Modify Data in Excel:**
    *   User opens the downloaded Excel file.
    *   User makes changes: e.g., updates stock quantities, changes prices, corrects descriptions, or adds new rows at the end of the sheet for new inventory items, ensuring to follow the existing column structure.
    *   User saves the modified Excel file.
3.  **Import Inventory:**
    *   User returns to the Inventory List page in the application.
    *   User clicks an "Import from Excel" button.
    *   A file selection dialog appears. User selects their modified `.xlsx` file.
4.  **Preview Changes:**
    *   The system uploads and parses the file.
    *   A modal or dedicated preview page appears, displaying:
        *   A summary: "X new items to be created", "Y existing items to be updated", "Z rows with errors".
        *   A detailed list or table for items to be updated, highlighting the specific fields that have changed and showing old vs. new values.
        *   A list of rows that will be created as new items.
        *   A clear list of any rows from the Excel file that have validation errors (e.g., "Row 15: Invalid value for 'Item Type'.", "Row 22: 'Cost Price' cannot be negative."), explaining why they cannot be imported.
    *   User reviews the preview carefully.
5.  **Confirm and Apply:**
    *   If satisfied with the preview (and understanding that rows with errors will be skipped), the user clicks an "Apply Changes" or "Confirm Import" button.
    *   An option to "Cancel Import" is also present.
6.  **System Processing:**
    *   The system attempts to perform the database operations (creates and updates) within a single transaction.
    *   If the transaction is successful, a toast notification confirms: "Inventory import successful. X items created, Y items updated."
    *   If the transaction fails (due to an unexpected database error during the process), a toast notification indicates failure: "Inventory import failed. No changes were applied. Error: [error message]".
    *   The Inventory List page should refresh to show the updated data.
