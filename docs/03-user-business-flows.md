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
    *   Fills in the `InventoryForm` (SKU, Name, Description, Unit of Measure ('kpl'), Cost Price, Sales Price).
    *   Saves the item. **[Backend: `inventory.actions.createItem`]**
4.  **Record Initial Stock / Replenishment:**
    *   User navigates to the newly created item's detail page.
    *   User clicks 'Adjust Stock' or 'Record Purchase'.
    *   Enters quantity received (e.g., 100), selects transaction type ('Initial Stock' or 'Purchase Receipt'), adds optional notes/reference.
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
7.  **Process Order (Production/Fulfillment View):**
    *   (Fulfillment Staff) Navigates to the 'Production' or 'Fulfillment' view (Kanban/Table).
    *   Finds the 'Confirmed' order.
    *   Updates status manually as it moves through stages (e.g., 'Picking' -> 'Packing' -> 'Ready for Shipment'). **[Backend: `order.actions.updateOrderStatus`]**
8.  **Mark Order as Shipped/Completed:**
    *   Once ready, user marks the order as 'Shipped' or 'Completed'.
    *   This signifies the order is ready for invoicing. **[Backend: `order.actions.updateOrderStatus` to 'shipped']**
9.  **Generate Invoice:**
    *   (Finance Clerk) Navigates to the detail page of a 'Shipped' order.
    *   User clicks the 'Create Invoice' button.
    *   System pre-populates the invoice form with customer details, line items, prices, and totals from the order.
    *   User reviews the invoice, sets the due date (or accepts default), and can add notes or set VAT Reverse Charge.
    *   Saves the invoice (status 'Draft'). **[Backend: `invoice.createFromOrder` tRPC mutation]**
    *   **System Action:** Order status is updated to `INVOICED`. **[Backend: `invoice.createFromOrder` tRPC mutation]**
    *   **UI Flow:** A modal appears: "Invoice draft [invoice_number] created. Go to draft?" (Yes/No).
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

## 3. Other Key Flows (Summary)

*   **Customer Creation:** Navigate to Customers -> Add New -> Fill Form (inc. Finvoice details like VAT ID, OVT) -> Save. **[Backend: `customer.actions.createCustomer`]**
*   **Inventory Adjustment:** Navigate to Inventory Item -> Adjust Stock -> Enter Quantity (+/-), Reason -> Save. **[Backend: `inventory.actions.adjustStock`]**
*   **Manual Invoice Creation:** Navigate to Invoices -> Add New -> Select Customer -> Add Line Items Manually -> Set Due Date -> Save as Draft. **[Backend: `invoice.actions.createManualInvoice`]**

## 4. Backend Interaction Focus

- **Data Validation:** All backend actions (Server Actions or tRPC mutations) MUST validate input using corresponding Zod schemas before interacting with the database.
- **Database Operations:** Actions perform CRUD operations using the Prisma client (`src/lib/db.ts`). Ensure RLS is enforced where applicable (though primary user checks are often via `ctx.session.user.id` in tRPC).
- **State Updates:** Actions should return updated data or success/error status.
- **UI Revalidation:** Actions should use Next.js's `revalidatePath` or `revalidateTag` to ensure the UI reflects changes after mutations.
- **Error Handling:** Actions must handle potential database errors or validation failures gracefully, returning structured error information to the frontend.
- **Finvoice Generation:** The `invoice.actions.generateFinvoiceXml` action orchestrates fetching all necessary data (invoice, customer, items, settings) and calling the `finvoice.service` to build the XML.

## 1. Customer Management

1.  User navigates to the Customers section.
2.  User can view a list of customers, filter, and sort.
3.  User clicks "Add Customer" or selects an existing customer to edit.
4.  User fills/modifies the customer form (including e-invoicing details).
5.  User saves the customer.
6.  User can view customer details, including linked addresses, orders, and invoices.

## 2. Inventory & BOM Management

1.  **Item Creation:**
    *   User navigates to Inventory section.
    *   User clicks "Add Item".
    *   User fills in item details (SKU, Name, Type: Raw Material/Manufactured, Prices, UoM, Stock Levels).
    *   User checks/unchecks "Show in Pricelist".
    *   User saves the item.
2.  **BOM Creation (for Manufactured Items):**
    *   User navigates to the detail view of a "Manufactured" Inventory Item.
    *   User clicks "Manage BOMs" (or similar action).
    *   User clicks "Create New BOM".
    *   User adds component items (Raw Materials) and quantities.
    *   User enters optional `manualLaborCost`.
    *   System displays calculated cost (based on components + labor).
    *   User saves the BOM.
3.  **Stock Update (Purchase/Adjustment):**
    *   User (or system via Purchase Order module - future) initiates a stock update.
    *   User selects item, enters quantity (positive for purchase/in, negative for adjustment out), adds notes/reference.
    *   System creates an `InventoryTransaction` record.
4.  **Stock Alerts View:**
    *   User navigates to Inventory section.
    *   A dedicated table/widget displays items currently below minimum/reorder levels OR with negative calculated stock.
5.  **Pricelist Generation:**
    *   User navigates to Inventory section.
    *   User clicks "Show Pricelist" button.
    *   The table filters to show only "Manufactured" items where `showInPricelist` is true.
    *   User clicks "Export Pricelist".
    *   System generates and downloads a PDF pricelist based on the filtered view.

## 3. Sales Flow (Quotation / Work Order -> Invoice)

1.  **Order Creation (Quote or Work Order):**
    *   User navigates to Orders section.
    *   User clicks "Create Order".
    *   User selects `orderType` (Quotation or Work Order) - this determines form layout/options.
    *   User selects Customer.
    *   User adds line items (selecting from Inventory Items where `showInPricelist` is true).
    *   User enters discounts (Amount or %) per line item if applicable.
    *   (Work Order only): User sees BOM details; Pricing hidden.
    *   (Quotation only): User sees Pricing; BOM details hidden.
    *   User saves the Order (initially as Draft).
2.  **Quotation Flow:**
    *   User updates Quotation status (e.g., Sent, Accepted, Lost).
    *   If Accepted, user might have an action to "Convert to Work Order" (creates a new Work Order linked to the Quote) or "Create Invoice".
3.  **Work Order Flow:**
    *   User confirms the Work Order.
    *   User potentially sends the Work Order to Production (updates status to `in_production`).
        *   **System Action:** On status change to `in_production`, system calculates required raw materials based on BOMs and creates negative `InventoryTransaction` records. If stock goes negative, a Stock Alert is generated, but the process continues.
    *   Production module updates status (e.g., via Kanban drag) or User updates manually in Order view (e.g. Shipped, Delivered).
4.  **Invoice Creation:**
    *   Can be triggered from an accepted Quotation or a shipped/delivered Work Order, or created manually.
    *   If created from Order, line items, customer, discounts are pre-filled.
    *   User fills remaining details (Dates, Notes).
    *   User checks "VAT Reverse Charge" if applicable.
    *   User saves Invoice (Draft status).
5.  **Invoice Processing:**
    *   User updates status (Sent, Paid, Cancelled).
    *   User records payments.
    *   User generates Finvoice XML or PDF.
6.  **Credit Note:**
    *   User views a Paid/Sent Invoice.
    *   User clicks "Create Credit Note".
    *   System generates a new Invoice linked to the original, with negative amounts and `CREDITED` status, and updates the original Invoice status.

## 4. Production Flow (Simple)

1.  User navigates to Production section.
2.  User views Work Orders (where `orderType` is `work_order` and status is relevant, e.g., `in_production`, potentially other custom stages).
3.  View excludes pricing information.
4.  User drags cards (Kanban) or updates status (Table) to reflect progress through defined production stages.
5.  Updating status here might trigger updates back to the original Order status (e.g., moving to final stage sets Order to 'Shipped').
