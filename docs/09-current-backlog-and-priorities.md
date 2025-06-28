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

## 🔥 **Priority 3: Invoice Form Final Enhancements (MEDIUM)**

### **3.1 Row Free Text Fields**
- **Requirement**: Add free text field for each invoice/order item row
- **Purpose**: Additional descriptions, specifications, or notes per line item
- **Finvoice Compatibility**: Verify field inclusion in XML export format
- **UI**: Optional text area that expands when needed
- **Estimated Time**: 2 hours

### **3.2 Invoice Date Alignment Fix**
- **Requirement**: Fix vertical alignment of invoice date input with customer field
- **Issue**: Misaligned form inputs causing visual inconsistency
- **Solution**: Adjust CSS/Tailwind classes for proper alignment
- **Estimated Time**: 0.5 hours

### **3.3 Enhanced Discount UI**
- **Requirement**: Add "Add Discount" button for each row to show/hide discount columns
- **Current State**: Discount columns always visible, making form cramped
- **New Behavior**: Show discount columns only when needed per row
- **UI**: Toggle button to reveal discount percentage/amount fields
- **Estimated Time**: 1.5 hours

**Total Priority 3 Time**: 4 hours

---

## 🔥 **Priority 4: Table Consistency & Export Features (MEDIUM)**

### **4.1 Orders Table Multi-Select**
- **Requirement**: Add multi-select checkboxes to Orders table
- **Consistency**: Match Invoice and BOM table functionality
- **Bulk Actions**: Prepare for PDF export and other bulk operations
- **Estimated Time**: 1 hour

### **4.2 BOM Table Multi-Select**
- **Requirement**: Add multi-select checkboxes to BOM table
- **Consistency**: Match other advanced tables in the system
- **Future**: Enable bulk operations for BOMs
- **Estimated Time**: 1 hour

### **4.3 PDF Bulk Export**
- **Requirement**: Implement PDF export for selected orders/invoices
- **Functionality**: Generate and download multiple PDFs as ZIP file
- **UI**: "Export Selected as PDF" button when items are selected
- **Technical**: Batch PDF generation with progress indicator
- **Estimated Time**: 3 hours

**Total Priority 4 Time**: 5 hours

---

## 📋 **Priority 5: Customer Revenue & History Enhancement (LOW)**

### **5.1 Customer Total Revenue Display**
- **Requirement**: Show lifetime value on customer detail pages
- **Calculation**: Sum of all paid invoices (VAT-exclusive)
- **UI**: Prominent display on customer detail page
- **Performance**: Cached calculation for large datasets
- **Estimated Time**: 1.5 hours

### **5.2 Enhanced Order/Invoice History**
- **Requirement**: Improve existing history tables with totals
- **Features**: Summary statistics, filtering, better formatting
- **UI**: Enhanced tables with proper styling and information
- **Estimated Time**: 1.5 hours

**Total Priority 5 Time**: 3 hours

---

## 📋 **Priority 6: Advanced Features & Polish (LOW)**

### **6.1 Advanced Reporting Dashboard**
- **Features**: Profit margins, sales trends, inventory turnover
- **Charts**: Interactive charts with filtering and date ranges
- **Export**: Report export to Excel/PDF
- **Estimated Time**: 8 hours

### **6.2 Enhanced PDF Generation**
- **Requirements**: Professional templates for all document types
- **Features**: Company branding, customizable layouts
- **Documents**: Orders, quotations, credit notes, pricelists
- **Estimated Time**: 6 hours

### **6.3 Stock Alerts & Replenishment**
- **Features**: Low stock alerts, reorder point notifications
- **UI**: Alert dashboard, notification system
- **Automation**: Automated reorder suggestions
- **Estimated Time**: 4 hours

### **6.4 Credit Note Full Workflow**
- **Features**: Complete credit note creation and management
- **Integration**: Link to original invoices, proper accounting
- **UI**: Credit note forms, approval workflow
- **Estimated Time**: 5 hours

**Total Priority 6 Time**: 23 hours

---

## 🎯 **Implementation Roadmap**

### **✅ Phase 1: Critical Business Features (9 hours) - COMPLETED**
1. **✅ Localization Support** (6h) - International business operations ✅ **COMPLETED**
2. **✅ Production Kanban Enhancement** (3h) - Manufacturing workflow improvement ✅ **COMPLETED**

### **Phase 2: Form & UI Polish (4 hours)**
3. **Invoice Form Polish** (4h) - Complete invoice functionality and UX improvements

### **Phase 3: Consistency & Export (8 hours)**
4. **Table Multi-Select** (2h) - UI consistency across tables
5. **PDF Bulk Export** (3h) - Advanced export functionality
6. **Customer Revenue Display** (3h) - Complete customer management

### **Phase 4: Advanced Features (23 hours)**
7. **Advanced Reporting** (8h) - Business intelligence
8. **Enhanced PDF Generation** (6h) - Professional document output
9. **Stock Management** (4h) - Inventory optimization
10. **Credit Note Workflow** (5h) - Complete financial workflow

---

## 📊 **Priority Matrix**

| Feature | Business Impact | Technical Complexity | User Demand | Priority | Status |
|---------|----------------|---------------------|-------------|----------|---------|
| ✅ Customer Language Selection | High | Low | High | 1 | **COMPLETED** |
| ✅ Localized Invoice Output | High | Medium | High | 1 | **COMPLETED** |
| ✅ Kanban Card Management | Medium | Low | Medium | 2 | **COMPLETED** |
| ✅ Enhanced Drag-and-Drop | Medium | Low | High | 2 | **COMPLETED** |
| Invoice Form Enhancements | Medium | Low | Medium | 3 | **IN PROGRESS** |
| Table Multi-Select | Low | Low | Low | 4 | **PENDING** |
| PDF Bulk Export | Medium | Medium | Medium | 4 | **PENDING** |
| Customer Revenue Display | Low | Low | Low | 5 | **PENDING** |
| Advanced Reporting | High | High | Medium | 6 | **PENDING** |
| Enhanced PDF Templates | Medium | Medium | Low | 6 | **PENDING** |

---

## 🚀 **Next Actions for AI Agent**

### **Immediate Focus (Next Session)**
1. **Invoice Form Enhancements**: Add row free text fields and fix date alignment issues
2. **Enhanced Discount UI**: Implement toggle-based discount column visibility
3. **Orders Table Multi-Select**: Complete multi-select functionality for consistency

### **Success Criteria**
- Invoices and orders support detailed line item descriptions
- Form layouts are visually consistent and professional
- All major tables have consistent multi-select functionality
- Build stability maintained throughout all changes

### **Technical Notes**
- Focus on form UX improvements and visual consistency
- Implement proper TypeScript typing for all new features
- Test form validation and error handling thoroughly
- Maintain existing design patterns and emerald theme

---

**Current Development Status**: System is production-ready with 95% completion. Recent production workflow enhancements significantly improve manufacturing team experience. Next focus should be on invoice form polish and table consistency features. 