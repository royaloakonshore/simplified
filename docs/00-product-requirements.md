# Product Requirements Document (PRD) - Simplified ERP System

## 1. Introduction

This document outlines the requirements for the Simplified ERP System, a web application designed to streamline core business processes including inventory management, order processing, invoicing, and customer relationship management for small to medium-sized businesses.

## 2. Goals

- Provide a user-friendly interface for managing core ERP functions.
- Ensure data integrity and accuracy through strong typing and validation.
- Integrate seamlessly with Finnish accounting standards via Finvoice export (specifically Netvisor compatible).
- Offer a robust and scalable platform built on modern web technologies.
- Minimize bugs through best practices in development and testing.

## 3. Target Audience

- Small to Medium-sized Businesses (SMBs) operating in Finland.
- Users include administrators, sales representatives, inventory managers, and finance personnel.

## 4. Key Features

### 4.1. Authentication & Authorization
- Secure user login/logout.
- User registration (optional, configurable).
- Password reset functionality.
- Role-based access control (e.g., Admin, Sales, Inventory, Finance).

### 4.2. Customer Management (CRM)
- Create, Read, Update, Delete (CRUD) customer records (businesses and individuals).
- Store multiple addresses (billing, shipping) per customer.
- Manage contact persons associated with customers.
- Store essential customer details required for Finvoice (VAT ID, identifiers, etc.).
- View customer order and invoice history.

### 4.3. Inventory Management
- CRUD operations for inventory items (products/materials).
- Track stock levels across multiple locations (if applicable, otherwise single default location).
- Record inventory transactions (purchase receipts, sales shipments, adjustments).
- Define item properties (SKU, name, description, cost price, sales price, unit of measure).
- Low stock level warnings/indicators.
- Simple inventory reporting (stock levels, basic valuation).

### 4.4. Order Management
- Create sales orders with line items referencing inventory items.
- Manage order lifecycle statuses (e.g., Draft, Confirmed, Processing, Shipped, Delivered, Cancelled).
- Automatically allocate inventory upon order confirmation (or indicate backorder).
- Generate packing slips/delivery notes (simple view/print).
- Link orders to customers.
- View order history and statuses.

### 4.5. Production/Fulfillment (Simple)
- A simple view (Kanban or Table) to track order progression through fulfillment stages (e.g., Confirmed -> Picking -> Packing -> Ready for Shipment).
- Allow manual status updates for these stages.

### 4.6. Invoicing
- Generate invoices from completed/shipped orders.
- Create manual invoices (optional).
- Manage invoice lifecycle statuses (e.g., Draft, Sent, Paid, Overdue, Cancelled).
- Include all necessary fields for Finvoice 3.0 compliance (as per Netvisor requirements).
- Calculate totals, taxes (VAT), and due dates.
- Record payments against invoices (manual marking).
- Generate a Finvoice 3.0 XML export file compatible with Netvisor import.
- View invoice history and payment status.

## 5. Non-Functional Requirements

- **UI/UX:** Clean, intuitive, monochrome (black/white/gray) design using Shadcn UI. Responsive and mobile-first.
- **Performance:** Fast load times, responsive UI interactions. Efficient database queries.
- **Scalability:** Architecture should support growing data volumes and user base.
- **Security:** Secure authentication, protection against common web vulnerabilities (XSS, CSRF), proper data isolation (RLS in Supabase).
- **Reliability:** High uptime, robust error handling, data consistency.
- **Maintainability:** Clean, well-documented, modular code. Easy to update and extend.
- **Testability:** Code designed for unit, integration, and potentially E2E testing.

## 6. Data & Integration

- **Database:** PostgreSQL (via Supabase).
- **Finvoice Export:** Generate XML conforming to Finvoice 3.0 standard, specifically tailored for Netvisor import specifications.

## 7. Future Considerations (Out of Scope for Initial Build)

- Advanced reporting and analytics.
- Purchase order management.
- Multi-currency support.
- Direct payment gateway integration.
- API for external integrations.
- Multi-tenancy (support for multiple distinct organizations).
