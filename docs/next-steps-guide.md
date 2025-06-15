# Next Steps Guide - Simplified ERP System

*Last Updated: January 27, 2025*

## 🎯 **Current System Status: 66% Complete**

### ✅ **Recently Completed**
- Order & Invoice submission modals with next-step actions
- PDF export foundation (backend ready, placeholder implementation)
- Send to Work Order functionality for quotations
- Multi-tenancy implementation with company switching
- Performance indexes ready for deployment

### 🚨 **Critical Blockers (Fix Immediately)**
1. **BOM Detail Page Build Error** - `/boms/[id]/page.tsx` PageProps compatibility issue
2. **Deploy Performance Indexes** - Ready migration for 60-80% query improvement  
3. **Form TypeScript Issues** - `InventoryItemForm.tsx`, `OrderForm.tsx` using `@ts-nocheck`

---

## 🔥 **Week 1 Immediate Priorities (40 hours)**

### **Day 1-2: Foundation & Quick Wins (16h)**
1. **Deploy Performance Indexes** (0.5h) ⚡
   ```bash
   npx prisma migrate dev --name "add_performance_indexes"
   ```
2. **Fix BOM Detail Page** (2h) 🔧
3. **Inventory Category Pills** (3h) 🎨
   - Add `InventoryCategory` column with pill tags
   - Enable filtering by category
4. **Conditional Vendor Fields** (2h) 🎯
   - Hide `vendorSku`/`vendorItemName` for manufactured goods
5. **Customer Action Dropdown** (4h) 🎛️
   - Replace "Edit" button with dropdown menu
   - Add "Create Invoice/Quote/Work Order" actions
6. **Order Table Enhancements** (5h) 📊
   - Add VAT amount column
   - Add order type pills
   - Implement multi-select checkboxes

### **Day 3-4: Advanced Features (16h)**
1. **Invoice Actions Consolidation** (6h) 🎛️
2. **Searchable Select Components** (8h) 🔍
3. **Logo Upload + Finvoice Integration** (9h) ⚙️

### **Day 5: Dashboard Transformation (8h)**
1. **Dashboard Real Data Integration** (8h) 📈

---

## 🏗️ **Technical Implementation Details**

### **Schema Changes for Line Item Enhancements**

#### Update Prisma Schema

```prisma
// In OrderItem model
model OrderItem {
  id             String        @id @default(cuid())
  orderId        String
  itemId         String
  quantity       Decimal       @db.Decimal(10, 2)
  unitPrice      Decimal       @db.Decimal(10, 2)
  discountAmount Decimal?      @db.Decimal(10, 2)  // Add this field
  discountPercent Decimal?     @db.Decimal(5, 2)   // Add this field
  // ... existing relations
  
  @@schema("public")
}

// In Invoice model
model Invoice {
  // ... existing fields
  vatReverseCharge Boolean        @default(false)  // Add this field
  // ... existing relations
  
  @@schema("public")
}

// In InvoiceItem model
model InvoiceItem {
  id             String        @id @default(cuid())
  invoiceId      String
  itemId         String
  description    String?
  quantity       Decimal       @db.Decimal(10, 2)
  unitPrice      Decimal       @db.Decimal(10, 2)
  vatRatePercent Decimal       @db.Decimal(5, 2)
  discountAmount Decimal?      @db.Decimal(10, 2)  // Add this field
  discountPercent Decimal?     @db.Decimal(5, 2)   // Add this field
  // ... existing relations
  
  @@schema("public")
}
```

### **Update Zod Schemas**

#### Order Schemas
```typescript
export const orderItemSchema = z.object({
  // ... existing fields
  discountAmount: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});
```

#### Invoice Schemas
```typescript
export const invoiceSchema = z.object({
  // ... existing fields
  vatReverseCharge: z.boolean().default(false),
});

export const invoiceItemSchema = z.object({
  // ... existing fields
  discountAmount: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  vatRatePercent: z.number().min(0).max(100).default(25.5),
});

export const FINNISH_VAT_RATES = [25.5, 14, 10, 0] as const;
```

### **Calculation Logic Updates**

#### Order Total Calculation
```typescript
const calculateOrderTotal = async (items: OrderItemInput[]) => {
  let total = new Prisma.Decimal(0);
  for (const item of items) {
    const price = new Prisma.Decimal(item.unitPrice);
    const quantity = new Prisma.Decimal(item.quantity);
    let lineTotal = price.mul(quantity);
    
    // Apply discount if present
    if (item.discountPercent) {
      const discountMultiplier = new Prisma.Decimal(1).minus(
        new Prisma.Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.mul(discountMultiplier);
    } else if (item.discountAmount) {
      lineTotal = lineTotal.minus(new Prisma.Decimal(item.discountAmount));
    }
    
    total = total.add(lineTotal);
  }
  return total;
};
```

#### Invoice VAT Calculation
```typescript
function calculateTotalVat(
  items: { 
    quantity: number | Decimal, 
    unitPrice: number | Decimal, 
    vatRatePercent: number | Decimal,
    discountAmount?: number | Decimal, 
    discountPercent?: number | Decimal 
  }[],
  vatReverseCharge: boolean = false
): Decimal {
  // If reverse charge is enabled, VAT is always 0
  if (vatReverseCharge) {
    return new Decimal(0);
  }

  const totalVat = items.reduce((sum, item) => {
    const lineTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    
    // Apply discount if present
    let discountedTotal = lineTotal;
    if (item.discountPercent) {
      const discountMultiplier = new Decimal(1).minus(
        new Decimal(item.discountPercent.toString()).div(100)
      );
      discountedTotal = lineTotal.times(discountMultiplier);
    } else if (item.discountAmount) {
      discountedTotal = lineTotal.minus(new Decimal(item.discountAmount.toString()));
    }
    
    const vatAmount = discountedTotal.times(new Decimal(item.vatRatePercent.toString()).div(100));
    return new Decimal(sum.toString()).plus(vatAmount);
  }, new Decimal(0));
  
  return totalVat;
}
```

---

## 📊 **Module Status & Next Features**

### **Customer Module (85% → 95%)**
- ✅ Advanced table with search/filter/sort
- ⚠️ **NEXT**: Action dropdown (Create Invoice/Quote/Work Order)
- ⚠️ **NEXT**: Customer detail page with order/invoice history

### **Inventory Module (65% → 75%)**
- ✅ Basic CRUD, quantity management, new fields
- ⚠️ **NEXT**: Category pills, conditional UI, advanced table features
- ⚠️ **NEXT**: Replenishment module (`/inventory/replenishment`)

### **Order Module (80% → 85%)**
- ✅ Full lifecycle, submission modals, send to work order
- ⚠️ **NEXT**: Searchable selects, multi-select, VAT column, type pills

### **Invoice Module (75% → 80%)**
- ✅ Full CRUD, VAT handling, submission modals
- ⚠️ **NEXT**: Consolidated actions, searchable selects, actual PDF

### **BOM Module (40% → 50%)**
- ✅ Backend complete, basic UI scaffolding
- 🚫 **BLOCKED**: Detail page build error
- ⚠️ **NEXT**: Enhanced selection UI, delete functionality

### **Dashboard Module (30% → 50%)**
- ✅ Basic layout with placeholders
- ⚠️ **NEXT**: Real data integration, key metrics, charts

---

## 🎯 **Success Metrics**

### **Week 1 Targets**
- ✅ 0 critical build errors
- ✅ 3 blockers resolved
- ✅ 60%+ performance improvement
- ✅ 6+ user-facing improvements

### **Quality Gates**
- No features shipped with `@ts-nocheck`
- All TypeScript compilation clean
- Performance regression tests pass
- User acceptance testing completed

---

## 🚀 **Execution Strategy**

1. **Start with highest ROI** (performance indexes, BOM fix)
2. **Build foundations** (category pills, conditional UI)
3. **Enhance user workflows** (customer dropdown, searchable selects)
4. **Transform dashboard** (real data, meaningful metrics)
5. **Maintain quality** (no technical debt, proper testing)

---

*This guide balances immediate user value with strategic foundation building for long-term system success.* 