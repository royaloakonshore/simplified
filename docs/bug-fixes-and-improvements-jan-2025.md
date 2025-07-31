# Bug Fixes and UX Improvements - January 2025

## Overview
Comprehensive list of identified issues and improvements needed across the ERP system, prioritized from smallest to largest implementation effort.

## Issues Identified

### 1. **Quotation Creation Bug** (Small)
**Problem**: Three dots menu "Create quotation" for customer enters customer details instead of starting quotation
**Expected**: Navigate to order form with customer pre-selected and quotation type set
**Implementation**: Fix action mapping in customer table dropdown menu

### 2. **Penalty Interest Field Editability** (Small)
**Problem**: Cannot delete numbers once entered in penalty interest field (Nordic decimal related)
**Location**: Invoice form, possibly reminder dialog
**Expected**: Allow full editing including deletion/clearing of field
**Implementation**: Fix Nordic decimal input handling for deletion

### 3. **Customer Number Missing in Orders** (Small)
**Problem**: Customer number not showing in orders despite customer having customer number
**Expected**: Customer number should be copied from customer to order on creation
**Implementation**: Fix field mapping in order creation logic

### 4. **Discount Autofill** (Medium)
**Problem**: % discount on item row should autofill corresponding discount amount field
**Expected**: When % discount entered, calculate and populate amount field (row total minus percent)
**Implementation**: Add reactive calculation logic to form fields

### 5. **Missing Editable Fields in Forms** (Medium)
**Problem**: Several fields need to be editable in order/invoice forms:
- Delivery date (default to invoice creation date, calendar editable)
- Our reference (blank, editable)
- Payment terms (editable)
- Huomautusaika (editable)
- Penalty interest (editable)
- Delivery method (editable)
**Implementation**: Update form schemas and UI components

### 6. **Order Sent Modal Enhancement** (Medium)
**Problem**: Order sent modal needs three alternatives like invoice modal:
1. Mark as sent and download PDF
2. Mark as sent
3. Save as draft
**Expected**: All update status accordingly, draft stays draft, redirect to table, PDF creates download
**Implementation**: Enhance existing modal with additional options

### 7. **Invoice Draft Prefilling from Production** (Medium)
**Problem**: Invoice draft created from production view missing prefilled info:
- Penalty rate
- Customer number
- Huomautusaika
- Maksuehdot
- Toimituspäivä
**Expected**: All fields should be prefilled and editable
**Implementation**: Fix prefilling logic in production-to-invoice conversion

### 8. **Invoice Detail Address Layout** (Medium)
**Problem**: Address info missing from invoice details
**Expected**: Show shipping address first, then office address below customer name
**Research**: Check kitupiikki GitHub for lean invoice layout inspiration
**Implementation**: Update invoice detail view and PDF layout

### 9. **Customer Selection Dropdown Enhancement** (Large)
**Problem**: Need dual search/select dropdown in order/invoice forms for better UX with hundreds of customers
**Expected**: Same functionality as BOM creation but single select instead of multi-select
**Implementation**: Research BOM dropdown, adapt for single select, integrate into forms

### 10. **Margin Calculation Error** (Large)
**Problem**: Products with cost/labor price in both product and BOM details causing calculation errors
**Expected**: Combine product cost price + BOM labor price for total cost
**Scope**: Apply same logic to customer details/history and dashboard
**Implementation**: Update margin calculation logic across all components

### 11. **Performance Issues - Excessive Session Checks** (Large)
**Problem**: System checking session excessively on page transitions, causing slowness
**Evidence**: Multiple `/api/auth/session` calls per page load (see logs)
**Affected Pages**: Inventory, invoice edit, production, customer list, order details, dashboard
**Compilation Times**: 6-46 seconds per page
**Implementation**: Optimize session management, reduce redundant checks

## Performance Analysis from Logs

### Session Check Frequency
- Multiple session checks per page load
- `/api/auth/session` called repeatedly (49ms to 8616ms response times)
- `user.getMemberCompanies` called frequently alongside session checks

### Compilation Times
- Dashboard: 15.6s (5105 modules)
- Customer add: 6s (5558 modules)
- BOM list: 31.8s (5715 modules)
- Order add: 36.9s (large compilation)
- Invoice edit: 29.5s (5636 modules)
- Production: 11.8s (4504 modules)

### Network Request Patterns
- Batch tRPC requests with multiple procedures
- Long response times for data fetching (up to 14.1s)
- Repeated compilation for similar routes

## Implementation Priority

### Phase 1 (Quick Wins)
1. Fix quotation creation action mapping
2. Fix penalty interest field editability
3. Fix customer number mapping to orders

### Phase 2 (Medium Effort)
4. Implement discount autofill logic
5. Add missing editable fields to forms
6. Enhance order sent modal
7. Fix invoice draft prefilling
8. Update invoice detail address layout

### Phase 3 (Major Improvements)
9. Implement enhanced customer selection dropdown
10. Fix margin calculation logic across system
11. Optimize performance and session management

## Technical Considerations

### Downstream Effects to Consider
- Form schema updates may affect validation
- Field mapping changes may impact existing data
- Performance optimizations may affect authentication flow
- UI changes may require responsive design updates

### Files Likely to be Modified
- Customer table actions/dropdown menus
- Order/Invoice form components and schemas
- Margin calculation utilities
- Session management middleware
- tRPC procedures for data fetching
- PDF generation and invoice detail views

## Research Required
- BOM customer selection dropdown implementation
- Kitupiikki invoice layout patterns
- Next.js session optimization best practices
- tRPC batch request optimization
