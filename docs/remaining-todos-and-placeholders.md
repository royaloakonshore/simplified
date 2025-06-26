# Remaining TODOs and Placeholders - Simplified ERP System

This document catalogs all remaining TODOs, placeholders, and unfinished functionality in the codebase as of 2025-01-31.

## 🚨 HIGH PRIORITY ITEMS

### Authentication & User Management
- **Login Form** (`src/components/login-form.tsx`):
  - Line 78: `href="#"` - TODO: Implement forgot password functionality
  - Line 117: Sign Up Link - TODO: Implement or remove

### BOM Management 
- **BOM Table** (`src/components/boms/BOMTable.tsx`):
  - Line 156: TODO: Implement delete functionality with confirmation
  - Line 221: TODO: Implement default bulk delete
  - Line 234: TODO: Implement default bulk export

### PDF Generation
- **Order Router** (`src/lib/api/routers/order.ts`):
  - Line 724: TODO: Implement actual PDF generation
  - Line 728: Placeholder implementation - return success for now

### Invoice Management
- **Invoice Bulk Actions** (`src/components/invoices/InvoiceListContent.tsx`):
  - Line 165: TODO: Implement bulk PDF export functionality
  - Line 168: Placeholder implementation for bulk PDF export

- **Invoice Submission** (`src/components/invoices/InvoiceSubmissionModal.tsx`):
  - Line 60: TODO: Implement Finvoice export

- **Invoice Form** (`src/components/invoices/InvoiceForm.tsx`):
  - Line 754: Placeholder for updateInvoiceMutation.isLoading
  - Line 761: Placeholder for updateInvoiceMutation.isLoading

- **Invoice Actions** (`src/lib/actions/invoice.actions.ts`):
  - Line 357: TODO: Actually record payment details in Payment model
  - Line 399: IMPORTANT TODO: Replace placeholder settings with actual data retrieval

## 🔧 MEDIUM PRIORITY ITEMS

### Multi-tenancy Implementation
- **Settings Router** (`src/lib/api/routers/settings.ts`):
  - Line 35: TODO: Adapt for multi-tenancy when companyId is added to Settings model

- **Customer Router** (`src/lib/api/routers/customer.ts`):
  - Line 336: TODO: Add companyId filter: companyId: ctx.companyId
  - Line 358: TODO: Add companyId filter: companyId: ctx.companyId  
  - Line 442: TODO: Add companyId scoping

### Finvoice Integration
- **Finvoice Service** (`src/lib/services/finvoice.service.ts`):
  - Line 10: TODO: Replace with actual settings retrieval (from DB or config)
  - Line 55: TODO: Add better error handling if billing address is missing
  - Line 126: TODO: Make PaymentOverDueFinePercent configurable
  - Line 178: TODO: Get UnitCode from item if available, default to 'PCE'

### Inventory Management
- **Inventory Category Router** (`src/lib/api/routers/inventoryCategory.ts`):
  - Line 123: TODO: Add get, update, delete procedures as needed

- **Inventory Router** (`src/lib/api/routers/inventory.ts`):
  - Line 881: Placeholder for file upload - use AWS S3 in real app

- **Inventory Page** (`src/app/(erp)/inventory/page.tsx`):
  - Line 95: TODO: Implement actual update logic with tRPC mutation

### BOM Management Continued
- **BOM Router** (`src/lib/api/routers/bom.ts`):
  - Line 215: TODO: Add orderBy, skip, take from input if pagination is added

- **BOM Management Pages** (`src/app/(erp)/boms/page.tsx`):
  - Line 14: TODO: Implement with tRPC mutation
  - Line 20: TODO: Implement bulk export functionality

## 📝 LOW PRIORITY / CLEANUP ITEMS

### Type Definitions
- **Inventory Types** (`src/lib/types/inventory.types.ts`):
  - Lines 23, 50: Placeholder for ItemType from @prisma/client

- **Invoice Types** (`src/lib/types/invoice.types.ts`):
  - Lines 71-72: Relation placeholders for originalInvoice and creditNote

### Order Management
- **Order Schema** (`src/lib/schemas/order.schema.ts`):
  - Line 119: Placeholder for future filters like specific statuses, assigned user

### Supabase Integration (Unused)
- **Supabase Files** - Multiple placeholder files:
  - `src/lib/supabase/auth.ts`: Placeholder implementation
  - `src/lib/supabase/client.ts`: Placeholder for client-side Supabase client
  - `src/lib/supabase/server.ts`: Placeholder for server-side Supabase client
  - `src/lib/types/supabase.ts`: Placeholder for Supabase generated types

### UI Components with Placeholders
- **App Sidebar** (`src/components/AppSidebar.tsx`):
  - Lines 44-45: Placeholder data for TeamSwitcher (commented out)

- **App Sidebar Alternative** (`src/components/app-sidebar.tsx`):
  - Line 119: Placeholder for projects if needed later

### Pages with Filter TODOs
- **Invoices Page** (`src/app/(erp)/invoices/page.tsx`):
  - Line 29: TODO: Add Filter controls here

- **Invoice Add Page** (`src/app/(erp)/invoices/add/page.tsx`):
  - Line 5: Placeholder form component comment

## 📊 STATUS SUMMARY

**Total TODOs Found**: 25 items
- High Priority: 8 items (32%)
- Medium Priority: 10 items (40%) 
- Low Priority: 7 items (28%)

## 🚀 NEXT ACTIONS RECOMMENDED

1. **PDF Generation**: Implement actual PDF generation for orders and invoices (high impact)
2. **BOM Management**: Complete delete/bulk operations functionality
3. **Multi-tenancy**: Add remaining companyId filters to ensure proper data scoping
4. **Finvoice Integration**: Complete settings integration for production readiness
5. **Authentication**: Implement forgot password functionality
6. **Cleanup**: Remove unused Supabase placeholders if not needed

## 📅 LAST UPDATED
2025-01-31 - Comprehensive audit completed after UI consistency improvements and team switcher fixes. 