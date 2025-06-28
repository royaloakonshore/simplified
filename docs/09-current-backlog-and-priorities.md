# Current Backlog and Priorities - Simplified ERP System

*Last Updated: January 31, 2025*

## 🎯 **Current System Status: 95% Complete & Production Ready**

The system has reached exceptional stability with all critical runtime errors resolved and major UX improvements implemented. Core business workflows are fully functional with enhanced user experience. Recent Priority 1 and Priority 2 implementations have significantly improved the production workflow experience.

---

## ✅ **RECENTLY COMPLETED: Production Kanban Enhancement (COMPLETED)**

### **✅ 2.1 General Card Removal Button (COMPLETED)**
- **✅ Requirement**: Add remove button to kanban cards at any stage (not just shipped)
- **✅ Functionality**: UI-only removal with confirmation modal without status change
- **✅ UI**: X button on each card with confirmation dialog 
- **✅ Implementation**: Cards are hidden from kanban view but maintain their actual status
- **✅ Archive Integration**: Removed cards appear in archive tab with "UI Hidden" indicator

### **✅ 2.2 Send Back to Production Button (COMPLETED)**
- **✅ Requirement**: Button to restore removed cards back to kanban board
- **✅ Functionality**: UI-only restoration without status change for UI-hidden cards
- **✅ UI**: "Restore to Board" button in archive tab for UI-hidden orders
- **✅ Workflow**: Users can remove cards temporarily and restore them seamlessly

### **✅ 2.3 Enhanced Drag-and-Drop (COMPLETED)**
- **✅ Fixed Drag Limitation**: Cards can now be dragged from anywhere, not just the corner
- **✅ Maintained Sensitivity**: Kept the lowered move sensitivity (12px distance, 100ms delay)
- **✅ Visual Feedback**: Entire card shows drag cursor and proper visual states
- **✅ Improved UX**: Much more intuitive dragging experience for production users

**Total Priority 2 Completion Time**: 3 hours ✅ **COMPLETED**

---

## 🔥 **Priority 1: Localization & International Support (HIGH)**

### **1.1 Customer Language Selection**
- **✅ COMPLETED**: Add language field to Customer model and forms
- **✅ Languages**: Swedish (SE), Finnish (FI), English (EN)  
- **✅ UI**: Dropdown in customer creation/edit forms
- **✅ Default**: Finnish for new customers
- **✅ Database**: Added `language` enum field to Customer model

### **1.2 Localized Invoice/Quotation Output**
- **✅ COMPLETED**: Translate PDF and XML output based on customer language
- **✅ Key Translations**:
  - VAT → "ALV" (Finnish), "Moms" (Swedish), "VAT" (English)
  - Payment terms, due date labels, currency symbols
  - Invoice/quotation headers and field labels
- **✅ Finvoice Compliance**: XML remains Finvoice 3.0 compliant
- **✅ Implementation**: Language-specific templates and translation functions

**Total Priority 1 Time**: 6 hours ✅ **COMPLETED**

---

## 🔥 **Priority 3: PDF Generation with Giroblankett Payment Slip (MEDIUM-HIGH)**

### **3.1 Professional Invoice PDF Generation**
- **Requirement**: Implement server-side PDF generation for invoices using professional templates
- **Technology**: Server-side generation using Puppeteer or similar library
- **Template Structure**: HTML/CSS templates designed for PDF output
- **Company Branding**: Include company logos and customizable layouts
- **Estimated Time**: 4 hours

### **3.2 Giroblankett Payment Slip Integration (NEW REQUIREMENT)**
- **✅ CRITICAL**: Always include giroblankett payment slip at bottom of all invoice PDFs
- **Layout Requirements**: 
  - Exact positioning from Finnish LaTeX template reference
  - Bottom section of invoice with precise field layout
  - Reference: Finnish invoice template and Avoin Systems addon for formatting details
- **Text Labels**: Use flat Finnish/Swedish text without translation to English
  - "Tilisiirto" / "Bankgiro" / "IBAN" / "BIC" / "Viite" / "Summa" / "Eräpv."
  - Copy exact text from LaTeX template for consistent appearance
- **Payment Barcode**: Generate payment reference barcode if technically feasible
- **Field Population**:
  - Company IBAN from settings (`settings.bankAccountIBAN`)
  - Invoice reference number and amount
  - Due date and payment terms
- **Implementation Priority**: Include as default part of PDF layout (not optional)
- **Reference Materials**: 
  - Finnish LaTeX invoice template for exact layout
  - Avoin Systems l10n_fi_invoice addon for additional formatting guidance
- **Estimated Time**: 3 hours

### **3.3 Multi-Document PDF Support**
- **Requirement**: Extend PDF generation to orders, quotations, and credit notes
- **Consistency**: Apply giroblankett to all financial documents where applicable
- **Bulk Export**: Support for generating multiple PDFs simultaneously
- **Estimated Time**: 2 hours

**Total Priority 3 Time**: 9 hours

---

## 🔥 **Priority 4: Invoice Form Final Enhancements (MEDIUM)**

### **4.1 Row Free Text Fields**
- **Requirement**: Add free text field for each invoice/order item row
- **Purpose**: Additional descriptions, specifications, or notes per line item
- **Finvoice Compatibility**: Verify field inclusion in XML export format
- **UI**: Optional text area that expands when needed
- **Estimated Time**: 2 hours

### **4.2 Invoice Date Alignment Fix**
- **Requirement**: Fix vertical alignment of invoice date input with customer field
- **Issue**: Misaligned form inputs causing visual inconsistency
- **Solution**: Adjust CSS/Tailwind classes for proper alignment
- **Estimated Time**: 0.5 hours

### **4.3 Enhanced Discount UI**
- **Requirement**: Add "Add Discount" button for each row to show/hide discount columns
- **Current State**: Discount columns always visible, making form cramped
- **New Behavior**: Show discount columns only when needed per row
- **UI**: Toggle button to reveal discount percentage/amount fields
- **Estimated Time**: 1.5 hours

**Total Priority 4 Time**: 4 hours

---

## 📋 **Priority 5: Table Consistency & Export Features (LOW)**

### **5.1 Orders Table Multi-Select**
- **Requirement**: Add multi-select checkboxes to Orders table
- **Consistency**: Match Invoice and BOM table functionality
- **Bulk Actions**: Prepare for PDF export and other bulk operations
- **Estimated Time**: 1 hour

### **5.2 BOM Table Multi-Select**
- **Requirement**: Add multi-select checkboxes to BOM table
- **Consistency**: Match other advanced tables in the system
- **Future**: Enable bulk operations for BOMs
- **Estimated Time**: 1 hour

### **5.3 PDF Bulk Export**
- **Requirement**: Implement PDF export for selected orders/invoices
- **Functionality**: Generate and download multiple PDFs as ZIP file
- **UI**: "Export Selected as PDF" button when items are selected
- **Technical**: Batch PDF generation with progress indicator
- **Dependencies**: Requires Priority 3 PDF generation infrastructure
- **Estimated Time**: 3 hours

**Total Priority 5 Time**: 5 hours

---

## 📋 **Priority 6: Customer Revenue & History Enhancement (LOW)**

### **6.1 Customer Total Revenue Display**
- **Requirement**: Show lifetime value on customer detail pages
- **Calculation**: Sum of all paid invoices (VAT-exclusive)
- **UI**: Prominent display on customer detail page
- **Performance**: Cached calculation for large datasets
- **Estimated Time**: 1.5 hours

### **6.2 Enhanced Order/Invoice History**
- **Requirement**: Improve existing history tables with totals
- **Features**: Summary statistics, filtering, better formatting
- **UI**: Enhanced tables with proper styling and information
- **Estimated Time**: 1.5 hours

**Total Priority 6 Time**: 3 hours

---

## 📋 **Priority 7: Advanced Features & Polish (FUTURE)**

### **7.1 Advanced Reporting Dashboard**
- **Features**: Profit margins, sales trends, inventory turnover
- **Charts**: Interactive charts with filtering and date ranges
- **Export**: Report export to Excel/PDF
- **Estimated Time**: 8 hours

### **7.2 Enhanced PDF Generation Advanced Features**
- **Requirements**: Advanced PDF features beyond basic giroblankett
- **Features**: Custom templates, advanced branding, multi-language support
- **Documents**: Enhanced layouts and formatting options
- **Estimated Time**: 6 hours

### **7.3 Stock Alerts & Replenishment**
- **Features**: Low stock alerts, reorder point notifications
- **UI**: Alert dashboard, notification system
- **Automation**: Automated reorder suggestions
- **Estimated Time**: 4 hours

### **7.4 Credit Note Full Workflow**
- **Features**: Complete credit note creation and management
- **Integration**: Link to original invoices, proper accounting
- **UI**: Credit note forms, approval workflow
- **Estimated Time**: 5 hours

**Total Priority 7 Time**: 23 hours

---

## 🎯 **Implementation Roadmap**

### **✅ Phase 1: Critical Business Features (9 hours) - COMPLETED**
1. **✅ Localization Support** (6h) - International business operations ✅ **COMPLETED**
2. **✅ Production Kanban Enhancement** (3h) - Manufacturing workflow improvement ✅ **COMPLETED**

### **Phase 2: PDF Generation with Payment Infrastructure (9 hours)**
3. **PDF Generation with Giroblankett** (9h) - Professional invoice output with Finnish payment slips

### **Phase 3: Form & UI Polish (4 hours)**
4. **Invoice Form Enhancements** (4h) - Complete invoice functionality and UX improvements

### **Phase 4: Table Consistency & Export (5 hours)**
5. **Table Multi-Select & Bulk Operations** (5h) - UI consistency and advanced export functionality

### **Phase 5: Customer Management Enhancement (3 hours)**
6. **Customer Revenue & History** (3h) - Complete customer management features

### **Phase 6: Advanced Features (23 hours)**
7. **Advanced Reporting & Analytics** (8h) - Business intelligence
8. **Enhanced PDF Features** (6h) - Advanced document customization
9. **Stock Management & Alerts** (4h) - Inventory optimization
10. **Credit Note Workflow** (5h) - Complete financial workflow

---

## 📊 **Priority Matrix**

| Feature | Business Impact | Technical Complexity | User Demand | Priority | Status |
|---------|----------------|---------------------|-------------|----------|---------|
| ✅ Customer Language Selection | High | Low | High | 1 | **COMPLETED** |
| ✅ Localized Invoice Output | High | Medium | High | 1 | **COMPLETED** |
| ✅ Kanban Card Management | Medium | Low | Medium | 2 | **COMPLETED** |
| ✅ Enhanced Drag-and-Drop | Medium | Low | High | 2 | **COMPLETED** |
| PDF Generation with Giroblankett | High | Medium | High | 3 | **PENDING** |
| Invoice Form Enhancements | Medium | Low | Medium | 4 | **PENDING** |
| Table Multi-Select & Export | Low | Low | Low | 5 | **PENDING** |
| Customer Revenue Display | Low | Low | Low | 6 | **PENDING** |
| Advanced Reporting | High | High | Medium | 7 | **PENDING** |
| Enhanced PDF Features | Medium | Medium | Low | 7 | **PENDING** |

---

## 🚀 **Next Actions for AI Agent**

### **Immediate Focus (Current Session)**
1. **✅ Banner Image Updates**: Updated universal banner to GYKQBFeXIAAvHRU.jpeg and production page consistency ✅ **COMPLETED**

### **Next Priority (Priority 3: PDF Generation)**
1. **PDF Infrastructure Setup**: Implement server-side PDF generation using Puppeteer
2. **Giroblankett Payment Slip**: Add Finnish payment slip layout to bottom of all invoice PDFs
3. **Reference Integration**: Use exact positioning from LaTeX template and Avoin Systems addon
4. **Field Population**: Connect IBAN, reference numbers, and payment terms from company settings

### **Following Priorities (Priority 4+)**
1. **Invoice Form Polish**: Row free text fields, date alignment, enhanced discount UI
2. **Table Consistency**: Multi-select functionality across all major tables
3. **Customer Revenue Analytics**: Lifetime value calculations and enhanced history displays

### **Success Criteria**
- Professional invoice PDFs with authentic Finnish giroblankett payment slips
- Exact layout matching traditional Finnish invoice standards
- All required payment information populated from company settings
- Build stability maintained throughout all PDF implementations

### **Technical Notes**
- Follow established patterns for tRPC API design
- Implement proper TypeScript typing for PDF generation
- Test PDF output across different browsers and devices
- Reference Finnish LaTeX template for exact field positioning and text labels

---

**Current Development Status**: System is production-ready with 95% completion. Recent production workflow enhancements significantly improve manufacturing team experience. Next focus should be on invoice form polish and table consistency features. 