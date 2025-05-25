# User & Business Flows - Simplified ERP System

This document details key user and business process flows within the ERP system.

## 1. Core Entities & Lifecycle

*   **Customer:** Created -> Updated -> Used in Orders/Invoices
*   **Inventory Item:** Created -> Stock Adjusted (Purchased/Adjusted) -> Used in Orders -> Stock Decreased (Shipped)
*   **Order:** Draft -> Confirmed (Inventory Allocated) -> Processing (Production Stages) -> Shipped/Completed -> INVOICED
*   **Invoice:** Draft (From Order/Manual) -> Sent -> Payment Recorded -> Paid / Overdue -> Exported (Finvoice)

## 2. Detailed User Flow: Inventory Item Lifecycle & Sale

**Persona:** Inventory Manager, Sales Rep, Finance Clerk, Admin

**Goal:** Add a new product, manage its stock, sell it, invoice the customer, and export the invoice. Also, ensure user profile can be updated.

**Steps:**

1.  **Login & Profile Check (Admin/User):**
    *   User logs into the system.
    *   (Optional) User navigates to Settings -> Profile.
    *   User can update their Name and First Name. **[Backend: `user.updateProfile` tRPC mutation - Confirmed Working]**
    *   Saves the profile.
2.  **Navigate to Inventory:** User selects 'Inventory' from the navigation sidebar.
3.  **Create New Item:**
    *   User clicks 'Add New Item'.
    *   Fills in the `InventoryForm` (SKU, Name, Description, Unit of Measure ('kpl'), **VAT-exclusive Cost Price**, **VAT-exclusive Sales Price**).
    *   User selects **`Item Type`** (`RAW_MATERIAL` or `MANUFACTURED_GOOD`).
    *   User enters initial `quantity` on hand (this creates an initial 'positive' `InventoryTransaction`).
    *   Saves the item. **[Backend: `inventory.upsert` tRPC mutation or equivalent]**
4.  **Record Initial Stock / Replenishment:** (This is covered by initial quantity in step 3, or via stock adjustments)
    *   User navigates to an item's detail page.
    *   User clicks 'Adjust Stock'.
    *   Enters quantity received/deducted, selects transaction type ('Initial Stock', 'Purchase Receipt', 'Adjustment'), adds optional notes/reference.
    *   Saves the adjustment. **[Backend: `inventory.actions.adjustStock`]** (Creates an `InventoryTransaction`, updates calculated `InventoryItem.quantityOnHand`).
5.  **Create Sales Order:**
    *   (Sales Rep) Navigates to 'Orders'.
    *   Clicks 'Create New Order'.
    *   Selects an existing `Customer` (or creates a new one if needed).
    *   Adds a line item: Searches for the `Inventory Item` created earlier, enters quantity (e.g., 5).
    *   System shows item price, calculates line total.
    *   User reviews the order (customer details, items, totals).
    *   User Saves order as 'Draft'. **[Backend: `order.create` tRPC mutation with status 'draft' - Confirmed Working after ensuring valid `userId` in session and database]**
6.  **Confirm Order & Allocate Stock:**
    *   User navigates to the draft order's detail page.
    *   User clicks 'Confirm Order'.
    *   System checks if sufficient stock exists for all line items.
        *   If yes: Order status changes to 'Confirmed'. Inventory for the items is marked as 'allocated' or `quantityOnHand` is reduced (depending on chosen inventory model). **[Backend: `order.actions.updateOrderStatus` to 'confirmed', trigger inventory allocation/update `inventory.actions.updateStock`]**
        *   If no: Show error message indicating insufficient stock. Order remains 'Draft'.
7.  **Process Order (Production/Fulfillment View for Work Orders):**
    *   (Fulfillment Staff) Navigates to the 'Production' or 'Fulfillment' view (Kanban/Table).
    *   Finds a 'Confirmed' `Order` of `orderType = WORK_ORDER`.
    *   Updates status manually as it moves through stages (e.g., 'Picking' -> 'Packing' -> 'Ready for Shipment'). **[Backend: `order.actions.updateOrderStatus`]**
    *   **System Action (if applicable):** When an `Order` (type `WORK_ORDER`) status changes to `in_production`, the system identifies `MANUFACTURED_GOOD` items in the order. For each, it uses their `BillOfMaterial` to create negative `InventoryTransaction` records for the component raw materials, reducing their `quantityOnHand`.
8.  **Mark Order as Shipped/Completed:**
    *   Once ready, user marks the order as 'Shipped' or 'Completed'.
    *   This signifies the order is ready for invoicing. **[Backend: `order.actions.updateOrderStatus` to 'shipped']**
9.  **Generate Invoice:**
    *   (Finance Clerk) Navigates to the detail page of a 'Shipped' order or creates a manual invoice.
    *   User clicks the 'Create Invoice' button (if from order).
    *   System pre-populates the invoice form with customer details, line items (using **VAT-exclusive sales prices**), prices, and totals from the order.
    *   User reviews the invoice, sets the due date, and can add notes or set VAT Reverse Charge.
    *   **System Action (Profit Calculation):** For each line item, the system calculates and stores `calculatedUnitCost` (from `InventoryItem.costPrice` or `BillOfMaterial.totalCalculatedCost`), `calculatedUnitProfit`, and `calculatedLineProfit` (all VAT-exclusive).
    *   **System Action (Totals):** `Invoice.totalAmount` is stored as the sum of net line totals (VAT-exclusive). `Invoice.totalVatAmount` stores the sum of VAT per line. Customer payable total is net + VAT.
    *   Saves the invoice (status 'Draft'). **[Backend: `invoice.createFromOrder` or `invoice.createManual` tRPC mutation]**
    *   System Action: Order status is updated to `INVOICED` (if applicable).
    *   UI Flow: A modal appears: "Invoice draft [invoice_number] created. Go to draft?" (Yes/No).
        *   Yes: Navigates to the new invoice draft page.
        *   No: Modal closes, user remains on the order page (which now shows status `INVOICED`).
10. **Send Invoice:**
    *   User navigates to the draft invoice.
    *   Clicks 'Mark as Sent'. (This might trigger an email in a future version, but for now, just updates status).
    *   Invoice status changes to 'Sent'. Invoice becomes read-only for major changes. **[Backend: `invoice.actions.updateInvoiceStatus` to 'sent']**
11. **Export Finvoice:**
    *   User navigates to the 'Sent' invoice.
    *   Clicks 'Export Finvoice (Netvisor)'.
    *   System generates the Finvoice 3.0 XML file based on invoice data and settings. **[Backend: `invoice.actions.generateFinvoiceXml`]**
    *   The XML file is downloaded to the user's computer.
12. **Record Payment:**
    *   When payment is received (manually tracked outside the system initially), user navigates to the 'Sent' or 'Overdue' invoice.
    *   Clicks 'Record Payment'.
    *   Enters payment date and amount (defaults to full amount).
    *   Saves payment. Invoice status changes to 'Paid'. **[Backend: `invoice.actions.recordPayment`]** (Updates invoice status, maybe creates a simple `Payment` record linked to the invoice).

## 3. Backend Interaction Focus

- **Data Validation:** All backend actions (Server Actions or tRPC mutations) MUST validate input using corresponding Zod schemas before interacting with the database.
- **Database Operations:** Actions perform CRUD operations using the Prisma client (`src/lib/db.ts`). Ensure RLS is enforced where applicable (though primary user checks are often via `ctx.session.user.id` in tRPC).
- **State Updates:** Actions should return updated data or success/error status.
- **UI Revalidation:** Actions should use Next.js's `revalidatePath` or `revalidateTag` to ensure the UI reflects changes after mutations.
- **Error Handling:** Actions must handle potential database errors or validation failures gracefully, returning structured error information to the frontend.
- **Finvoice Generation:** The `invoice.actions.generateFinvoiceXml` action orchestrates fetching all necessary data (invoice, customer, items, settings) and calling the `finvoice.service` to build the XML.

## 4. Other Key Flows (Summary)

*   **Customer Creation:** Navigate to Customers -> Add New -> Fill Form -> Save. **[Backend: `customer.actions.createCustomer`]**
*   **BOM Creation (for `MANUFACTURED_GOOD` Inventory Items):** **[Backend Implemented, UI Pending]**
    *   Navigate to the detail view of a "Manufactured Good" Inventory Item.
    *   Manage BOMs: User initiates Create New BOM action (UI for this is **[PENDING]**).
    *   User adds component `InventoryItem`s (`RAW_MATERIAL` type) and quantities.
    *   Enter optional **VAT-exclusive `manualLaborCost`**.
    *   System calculates total BOM cost (based on components' VAT-exclusive `costPrice` + labor cost). This is saved to `BillOfMaterial.totalCalculatedCost` by the backend `bomRouter.upsert` procedure.
    *   User saves the BOM (via a **[PENDING]** UI form that calls the `bomRouter.upsert` procedure).
*   **Viewing Customer Details & History (NEW):**
    1.  User navigates to Customers section.
    2.  User selects a customer from the list.
    3.  The Customer Detail Page is displayed.
    4.  The page shows:
        *   General customer information (name, contact, VAT ID, etc.).
        *   A section/tab for "Order History" listing all orders associated with the customer. Key details per order: Order Number, Date, Status, Net Total. Each order links to its full detail page.
        *   A section/tab for "Invoice History" listing all invoices associated with the customer. Key details per invoice: Invoice Number, Date, Status, Net Total, VAT Amount, Gross Total. Each invoice links to its full detail page.
        *   A summary displaying "Total Net Revenue from Customer" (calculated from relevant invoices, VAT-exclusive).
