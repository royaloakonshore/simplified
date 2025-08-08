# Current Roadmap

## Completed ✅

### PDF Generation Background Jobs
- **Status**: COMPLETED
- **Description**: Background job system for PDF generation to handle large documents
- **Implementation**: Inngest jobs for invoice/order PDF generation

### Production-Ready PDF Generation
- **Status**: COMPLETED
- **Description**: Robust PDF generation with error handling and retry logic
- **Implementation**: Puppeteer-based PDF generation with proper error handling

### BOM PDF Export
- **Status**: COMPLETED ✅
- **Description**: PDF export for Bill of Materials with proper formatting
- **Implementation**: `/api/pdf/bom/[id]` route with UI button

## Current Priorities

### Performance Optimization (HIGHEST PRIORITY)
- **Status**: IN PROGRESS
- **Description**: Cache and memoization passes on heavy pages (Dashboard, Production, Inventory)
- **Tasks**:
  - [x] React Query smart caching for Dashboard, Production, Inventory pages
  - [x] Reduce re-renders with proper staleTime and gcTime configuration
  - [x] Verify query indexes are leveraged
  - [x] Review slow tRPC endpoints and N+1s
  - [x] Add deferred loading for heavy components
  - [x] Add total rows to invoice and order tables
- **Acceptance Criteria**: Measurable cold → warm load improvements, reduced re-renders

### Email PDF Attachments
- **Status**: IN PROGRESS
- **Description**: Implement attachments in send service with language-aware subjects
- **Tasks**:
  - [x] PDF attached to emails
  - [x] Language-aware subjects (FI/EN)
  - [x] Customer email integration
  - [x] Return buffers for download
- **Acceptance Criteria**: PDFs attached to emails, proper language handling

### Table Consistency Polish
- **Status**: IN PROGRESS
- **Description**: Ensure consistent sorting headers, filters, selection, pagination across tables
- **Tasks**:
  - [x] Invoice table consistency
  - [x] Order table consistency
  - [ ] Inventory table consistency
  - [ ] BOM table consistency
- **Acceptance Criteria**: All tables follow same pattern as Invoice table

### PDF Design Improvements
- **Status**: IN PROGRESS
- **Description**: Improve PDF design to match Finnish invoice standards
- **Tasks**:
  - [x] Move document type to top right
  - [x] Improve items table structure to match invoice details page
  - [x] Add support for "HUOMAUTUS" (reminder) title
  - [x] Enhanced styling for better readability
  - [ ] Reminder setup and logic
- **Acceptance Criteria**: Professional Finnish invoice appearance

## Backlog

### Reminder Setup
- **Status**: PENDING
- **Description**: Implement proper reminder logic and status handling
- **Tasks**:
  - [ ] Add reminder status to invoice model
  - [ ] Implement reminder generation logic
  - [ ] Add reminder templates
  - [ ] Update PDF generation for reminders
- **Acceptance Criteria**: Proper reminder workflow with "HUOMAUTUS" title

### Proper Giroblankett
- **Status**: PENDING
- **Description**: Ensure Invoice PDF has overflow-aware layout
- **Acceptance Criteria**: Giroblankett fits properly on page

### QR Codes on Work Orders
- **Status**: PENDING
- **Description**: Include QR codes for status updates on Order PDFs
- **Acceptance Criteria**: QR codes generated and displayed on work orders

### Multilingual Email Templates
- **Status**: PENDING
- **Description**: Support FI/EN in send service
- **Acceptance Criteria**: Language-aware email templates

---

**Note**: This document is authoritative for current priorities. Other roadmap documents are kept for historical reference. 