# SKU Integration and PDF Design Improvements Plan

**Date:** 2025-02-02  
**Status:** Implementation Plan  
**Priority:** High

## Overview

This document outlines the comprehensive plan to add SKU functionality as the first column in all invoice/order interfaces and improve the PDF design to match proper Finnish invoice standards.

## Current Analysis

### SKU Field Status
- ✅ **Database Schema**: SKU field exists in `InventoryItem` model (unique, optional)
- ✅ **Backend API**: SKU is included in tRPC procedures and validation
- ✅ **Forms**: SKU input exists in `InventoryItemForm` with proper validation
- ❌ **Table Display**: SKU not shown as first column in invoice/order tables
- ❌ **Search Functionality**: SKU not searchable in combobox components
- ❌ **PDF Display**: SKU not prominently displayed in PDF templates
- ❌ **Finvoice XML**: SKU not included as `ArticleIdentifier` in XML export

### PDF Design Issues
Based on comparison with [Finnish invoice examples](https://github.com/avoinsystems/avoinsystems-addons/tree/15.0/l10n_fi_invoice) and [LaTeX template](https://github.com/thejhh/finnish-invoice-template/blob/master/invoice.tex):

1. **LASKU Heading Position**: Currently left-aligned, should be top-right
2. **Number Formatting**: Missing thousand separators (1,000.00 vs 1000.00)
3. **Line Breaking**: Euro signs breaking to new lines
4. **Row Heights**: Payment details section too tall, should be compact
5. **Giroblankett Layout**: Not fitting properly on first page, overflow issues

## Implementation Plan

### Phase 1: SKU Integration (Priority 1)

#### 1.1 Update Invoice/Order Forms
- **File**: `src/components/invoices/InvoiceForm.tsx`
- **Changes**: 
  - Add SKU column as first column in line items table
  - Update searchable combobox to search by SKU in addition to name
  - Display format: `"SKU123 - Product Name"`

#### 1.2 Update Invoice/Order Detail Views
- **Files**: 
  - `src/components/invoices/InvoiceDetail.tsx`
  - `src/components/orders/OrderDetail.tsx`
- **Changes**:
  - Add SKU as first column in items table
  - Update table headers and cell structure

#### 1.3 Update Search Components
- **File**: `src/components/common/ComboboxResponsive.tsx` (or equivalent)
- **Changes**:
  - Enhance search to include SKU field
  - Update display format to show both SKU and name
  - Ensure proper filtering logic

#### 1.4 Update Backend Procedures
- **File**: `src/lib/api/routers/inventory.ts`
- **Changes**:
  - Ensure SKU is included in search procedures
  - Add SKU to selection in relevant queries

### Phase 2: Finvoice XML Integration (Priority 2)

#### 2.1 Add ArticleIdentifier to Finvoice Export
- **File**: `src/lib/services/finvoice.service.ts`
- **Research Finding**: Based on [Finvoice 3.0 specification](https://www.finanssiala.fi/en/finvoice/), the correct XML element is `<ArticleIdentifier>`
- **Implementation**:
  ```xml
  <ArticleIdentifier IdentificationSchemeName="SELLER">SKU123</ArticleIdentifier>
  ```
- **Line 182**: Replace comment with actual implementation
- **Changes**:
  ```typescript
  // Add after RowPositionIdentifier
  if (item.inventoryItem?.sku) {
    row.ele('ArticleIdentifier', { IdentificationSchemeName: 'SELLER' })
       .txt(item.inventoryItem.sku).up();
  }
  ```

### Phase 3: PDF Design Improvements (Priority 1)

#### 3.1 Fix LASKU Heading Position
- **File**: `src/lib/services/pdf.service.ts`
- **Current Issue**: LASKU heading is left-aligned in header
- **Solution**: Move to top-right corner with proper styling
- **Changes**:
  ```css
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .document-type {
    text-align: right;
    font-size: 24px;
    font-weight: bold;
    color: #0066cc;
  }
  ```

#### 3.2 Add Thousand Separators
- **File**: `src/lib/services/pdf.service.ts`
- **Implementation**: Create number formatting utility
- **Function**:
  ```typescript
  const formatCurrencyForPDF = (amount: string | number): string => {
    const num = new Decimal(amount.toString());
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  ```

#### 3.3 Fix Line Breaking Issues
- **File**: `src/lib/services/pdf.service.ts`
- **Solution**: Use CSS `white-space: nowrap` for currency cells
- **Changes**:
  ```css
  .currency-cell {
    white-space: nowrap;
    text-align: right;
  }
  ```

#### 3.4 Compact Payment Details Section
- **File**: `src/lib/services/pdf.service.ts`
- **Reference**: [AvoINSystems template](https://github.com/avoinsystems/avoinsystems-addons/tree/15.0/l10n_fi_invoice)
- **Changes**:
  ```css
  .info-table td {
    padding: 2px 0; /* Reduce from current padding */
    line-height: 1.2;
  }
  ```

#### 3.5 Fix Giroblankett Layout
- **File**: `src/lib/services/pdf.service.ts`
- **Reference**: [LaTeX template](https://github.com/thejhh/finnish-invoice-template/blob/master/invoice.tex)
- **Issues**: 
  - Overflow to next page despite available space
  - Incorrect positioning and sizing
- **Solution**: 
  - Reduce giroblankett height
  - Improve page break logic
  - Match standard Finnish giroblankett dimensions

#### 3.6 Add SKU to PDF Tables
- **File**: `src/lib/services/pdf.service.ts`
- **Changes**: Add SKU as first column in items table
- **Implementation**:
  ```html
  <th style="text-align: left; width: 12%;">SKU</th>
  <td>${item.inventoryItem?.sku || '-'}</td>
  ```

## Technical Specifications

### Database Requirements
- ✅ No schema changes needed (SKU field already exists)

### API Requirements
- ✅ SKU already included in tRPC procedures
- Minor updates to search procedures for enhanced filtering

### UI Components Requirements
- Update table column definitions
- Enhance search components
- Add proper responsive design for mobile

### Finvoice XML Compliance
- **Element**: `<ArticleIdentifier>`
- **Attributes**: `IdentificationSchemeName="SELLER"`
- **Content**: Internal SKU value
- **Standard**: [Finvoice 3.0 Implementation Guidelines](https://www.finanssiala.fi/finvoice/)

## Testing Plan

### SKU Functionality Testing
1. **Form Testing**: Verify SKU search in invoice/order forms
2. **Display Testing**: Confirm SKU appears as first column
3. **Search Testing**: Test combined SKU + name search functionality
4. **XML Testing**: Validate Finvoice XML includes ArticleIdentifier

### PDF Design Testing
1. **Layout Testing**: Verify LASKU positioning and overall layout
2. **Number Formatting**: Test thousand separators in all currency fields
3. **Responsive Testing**: Check layout on different PDF sizes
4. **Giroblankett Testing**: Verify proper positioning and page fitting

## Acceptance Criteria

### SKU Integration
- [ ] SKU appears as first column in all invoice/order tables
- [ ] SKU is searchable in combobox dropdowns
- [ ] SKU is included in Finvoice XML as ArticleIdentifier
- [ ] Search works with both SKU and product name

### PDF Design
- [ ] LASKU heading is positioned in top-right corner
- [ ] All currency amounts display with thousand separators
- [ ] No unwanted line breaks in currency fields
- [ ] Payment details section has compact row heights
- [ ] Giroblankett fits properly on first page without overflow
- [ ] Design matches Finnish invoice standards

## Risk Assessment

### Low Risk
- SKU display changes (already exists in database)
- Number formatting improvements
- CSS styling adjustments

### Medium Risk
- Search functionality changes (may affect performance)
- PDF layout changes (may affect existing documents)

### Mitigation Strategies
- Incremental rollout of changes
- Backup current PDF templates
- Test with real invoice data
- Performance testing for search functionality

## Timeline

### Week 1: SKU Integration
- Days 1-2: Update forms and display components
- Days 3-4: Enhance search functionality
- Day 5: Testing and refinement

### Week 2: PDF Improvements
- Days 1-2: Fix layout and positioning issues
- Days 3-4: Implement number formatting and styling
- Day 5: Giroblankett layout fixes

### Week 3: Finvoice and Polish
- Days 1-2: Add ArticleIdentifier to XML export
- Days 3-4: Final testing and adjustments
- Day 5: Documentation and deployment preparation

## Dependencies

- No external library dependencies required
- Existing PDF generation infrastructure
- Current tRPC and Prisma setup
- Finvoice service already implemented

## Success Metrics

- SKU search reduces item selection time by 50%
- PDF design matches Finnish standards as per reference templates
- No regression in existing functionality
- Positive user feedback on improved usability
- Finvoice XML validation passes with ArticleIdentifier

---

**Note**: This plan prioritizes user experience improvements while maintaining system stability and compliance with Finnish invoice standards.
