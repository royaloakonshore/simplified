# Current Backlog and Priorities - Simplified ERP System

*Last Updated: January 30, 2025*

## 🎯 **Current System Status: 85% Complete & Production Ready**

The system has reached a highly stable state with all critical runtime errors resolved and major UX improvements implemented. Core business workflows are fully functional with enhanced user experience. The remaining work focuses on localization, advanced features, and final polish.

---

## 🔥 **Priority 1: Localization & International Support (HIGH)**

### **1.1 Customer Language Selection**
- **Requirement**: Add language field to Customer model and forms
- **Languages**: Swedish (SE), Finnish (FI), English (EN)
- **UI**: Dropdown in customer creation/edit forms
- **Default**: English for new customers
- **Database**: Add `language` enum field to Customer model
- **Estimated Time**: 2 hours

### **1.2 Localized Invoice/Quotation Output**
- **Requirement**: Translate PDF and XML output based on customer language
- **Key Translations**:
  - VAT → "ALV" (Finnish), "Moms" (Swedish), "VAT" (English)
  - Payment terms, due date labels, currency symbols
  - Invoice/quotation headers and field labels
- **Finvoice Compliance**: Ensure XML remains Finvoice 3.0 compliant
- **Implementation**: Language-specific templates and translation functions
- **Estimated Time**: 4 hours

**Total Priority 1 Time**: 6 hours

---

## 🔥 **Priority 2: Production Kanban Enhancement (HIGH)**

### **2.1 General Card Removal Button**
- **Requirement**: Add remove button to kanban cards at any stage (not just shipped)
- **Functionality**: Temporarily remove cards from board without status change
- **UI**: X button or remove icon on each card
- **Confirmation**: "Are you sure?" dialog before removal
- **Estimated Time**: 1.5 hours

### **2.2 Send Back to Production Button**
- **Requirement**: Button to send removed cards back to kanban board
- **Functionality**: No actual status change, just visibility toggle
- **UI**: "Send to Production" button in removed cards view or separate section
- **Workflow**: User can remove cards temporarily and restore them
- **Estimated Time**: 1.5 hours

**Total Priority 2 Time**: 3 hours

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

### **Phase 1: Critical Business Features (13 hours)**
1. **Localization Support** (6h) - International business operations
2. **Production Kanban Enhancement** (3h) - Manufacturing workflow improvement
3. **Invoice Form Polish** (4h) - Complete invoice functionality

### **Phase 2: Consistency & Export (8 hours)**
4. **Table Multi-Select** (2h) - UI consistency across tables
5. **PDF Bulk Export** (3h) - Advanced export functionality
6. **Customer Revenue Display** (3h) - Complete customer management

### **Phase 3: Advanced Features (23 hours)**
7. **Advanced Reporting** (8h) - Business intelligence
8. **Enhanced PDF Generation** (6h) - Professional document output
9. **Stock Management** (4h) - Inventory optimization
10. **Credit Note Workflow** (5h) - Complete financial workflow

---

## 📊 **Priority Matrix**

| Feature | Business Impact | Technical Complexity | User Demand | Priority |
|---------|----------------|---------------------|-------------|----------|
| Customer Language Selection | High | Low | High | 1 |
| Localized Invoice Output | High | Medium | High | 1 |
| Kanban Card Management | Medium | Low | Medium | 2 |
| Invoice Form Enhancements | Medium | Low | Medium | 3 |
| Table Multi-Select | Low | Low | Low | 4 |
| PDF Bulk Export | Medium | Medium | Medium | 4 |
| Customer Revenue Display | Low | Low | Low | 5 |
| Advanced Reporting | High | High | Medium | 6 |
| Enhanced PDF Templates | Medium | Medium | Low | 6 |

---

## 🚀 **Next Actions for AI Agent**

### **Immediate Focus (Next Session)**
1. **Customer Language Field**: Add language enum to Customer model and forms
2. **Invoice Localization**: Implement translation functions for PDF/XML output
3. **Kanban Remove Buttons**: Add card removal functionality to production board

### **Success Criteria**
- Customers can select their preferred language (SE/FI/EN)
- Invoices and quotations output in customer's language
- Production team can temporarily remove cards from kanban board
- All features maintain existing build stability and type safety

### **Technical Notes**
- Maintain Finvoice 3.0 XML compliance with language codes
- Use proper TypeScript enums for language selection
- Implement confirmation dialogs for destructive actions
- Test localization with real customer data

---

**Current Development Status**: System is production-ready with 85% completion. Focus should be on international business support and manufacturing workflow enhancements to reach 95% completion. 