# 08: Inventory Deduction & Valuation Strategy

## Overview

This document outlines the simplified inventory management approach for stock deduction and valuation within the ERP system. The strategy prioritizes simplicity and practical manufacturing workflows over complex accounting methods.

## 1. Inventory Deduction Logic (✅ IMPLEMENTED)

### Current Implementation Status
- **BOM Component Deduction**: ✅ Fully implemented in `src/lib/api/routers/order.ts`
- **Stock Allocation**: ✅ Implemented with availability checking
- **Transaction Tracking**: ✅ All movements recorded via `InventoryTransaction`
- **Negative Stock Handling**: ✅ Allowed for production (doesn't block workflow)

### 1.1 Production Stock Deduction Flow

**Trigger**: When Order status changes to `in_production`

**Logic** (`handleProductionStockDeduction` function):
1. **Manufactured Items**: Deducts BOM component quantities
   - For each manufactured item in order
   - Calculates required component quantities: `bomItem.quantity × orderItem.quantity`
   - Creates negative `InventoryTransaction` for each component
   - Transaction type: `TransactionType.sale`
   - Reference: `"Production for Order ORD-XXXXX"`

2. **Raw Materials**: Direct deduction
   - Deducts ordered quantity directly from inventory
   - Creates negative `InventoryTransaction`
   - No BOM lookup required

3. **Transaction Recording**:
   ```typescript
   // Example transaction structure
   {
     itemId: componentItemId,
     quantity: requiredQuantity.negated(), // Negative for deduction
     type: TransactionType.sale,
     reference: `Production for Order ${orderNumber}`,
     note: `Component consumed for ${manufacturedItemName}`
   }
   ```

### 1.2 Stock Allocation (Order Confirmation)

**Function**: `checkAndAllocateStock`
- **Purpose**: Verify stock availability before order confirmation
- **Behavior**: Throws error if insufficient stock available
- **Use Case**: Prevents over-allocation of inventory

**Key Difference**: 
- **Allocation**: Checks availability, throws error if insufficient
- **Production Deduction**: Allows negative stock, records actual consumption

## 2. Inventory Valuation Strategy (📋 PLANNED)

### 2.1 Simple Valuation Method

**Approach**: **Standard Cost Method**
- Use `InventoryItem.costPrice` as the standard cost per unit
- Total inventory value = `Σ(quantityOnHand × costPrice)` for all items
- No complex FIFO/LIFO/Weighted Average calculations
- Suitable for small manufacturing businesses

### 2.2 Dashboard Implementation Requirements

**Goal**: Display "Total Inventory Value" on dashboard

**Implementation Plan**:

#### Backend (tRPC Procedure)
```typescript
// src/lib/api/routers/dashboard.ts (new router)
getTotalInventoryValue: companyProtectedProcedure
  .query(async ({ ctx }) => {
    const items = await prisma.inventoryItem.findMany({
      where: { companyId: ctx.companyId },
      select: { 
        id: true, 
        costPrice: true,
        quantityOnHand: true // May need transaction-based calculation
      }
    });
    
    const totalValue = items.reduce((sum, item) => {
      const quantity = Number(item.quantityOnHand);
      const cost = Number(item.costPrice);
      return sum + (quantity * cost);
    }, 0);
    
    return { totalInventoryValue: totalValue };
  })
```

#### Frontend (Dashboard Component)
- Add "Total Inventory Value" card to dashboard statistics section
- Format as currency using existing `formatCurrency()` utility
- Update periodically (React Query caching handles this)

### 2.3 Quantity Calculation Method

**Current System**: `quantityOnHand` calculated from `InventoryTransaction` records
```typescript
// Pattern used in inventory.ts router
const transactions = await prisma.inventoryTransaction.aggregate({
  where: { itemId },
  _sum: { quantity: true }
});
const quantityOnHand = transactions._sum.quantity ?? new Prisma.Decimal(0);
```

**For Dashboard**: Use same pattern to ensure consistency

## 3. Implementation Priority

### Phase 1: Dashboard Total Value (NEXT)
1. Create `dashboardRouter` in tRPC
2. Implement `getTotalInventoryValue` procedure
3. Add inventory value card to dashboard
4. Test with existing inventory data

### Phase 2: Enhanced Reporting (FUTURE)
- Inventory value by category
- Low stock value alerts
- Inventory turnover basic metrics

## 4. Business Rules & Assumptions

### 4.1 Cost Price Management
- **Standard Cost**: `costPrice` represents standard/average cost per unit
- **Manual Updates**: Cost prices updated manually when needed
- **No Automatic Adjustments**: System doesn't automatically adjust cost prices based on purchases

### 4.2 Valuation Principles
- **VAT-Exclusive**: All cost prices and valuations are VAT-exclusive
- **Negative Stock**: Negative quantities valued at zero (don't subtract from total value)
- **Active Items Only**: Only include active inventory items in valuation

### 4.3 Accuracy Considerations
- **Real-Time**: Valuation reflects current `quantityOnHand` calculations
- **Transaction-Based**: Quantities always calculated from transaction history
- **Company-Scoped**: Valuations are per-company in multi-tenant setup

## 5. Technical Implementation Notes

### 5.1 Performance Considerations
- **Dashboard Query**: Optimize for speed since it runs frequently
- **Indexing**: Ensure indexes on `companyId`, `itemId` for transaction queries
- **Caching**: Leverage React Query caching for dashboard data

### 5.2 Data Consistency
- **Transaction Integrity**: All inventory movements must create transactions
- **Decimal Handling**: Use established Decimal conversion patterns
- **Error Handling**: Graceful handling of missing cost prices (default to 0)

### 5.3 Future Extensibility
- **Valuation Methods**: Architecture allows for future FIFO/LIFO implementation
- **Reporting**: Foundation supports enhanced inventory reporting
- **Multi-Currency**: Can be extended for multi-currency cost tracking

## 6. Testing Strategy

### 6.1 Deduction Logic Testing
- ✅ **Current**: BOM deduction logic is tested and working
- **Verify**: Order status changes trigger correct deductions
- **Edge Cases**: Handle missing BOM data gracefully

### 6.2 Valuation Testing
- **Data Accuracy**: Verify calculations match manual calculations
- **Performance**: Test with realistic inventory sizes
- **Edge Cases**: Handle zero quantities, missing cost prices

## 7. Documentation Updates Required

When implementing dashboard valuation:
1. Update `00-product-requirements.md` - mark inventory valuation as implemented
2. Update `next-steps-guide.md` - add dashboard implementation task
3. Update `.cursor-updates` - document implementation progress

---

## Summary

**Current State**: ✅ Inventory deduction logic fully implemented and working
**Next Step**: 📋 Implement simple total inventory valuation for dashboard
**Approach**: Keep it simple with standard cost method
**Goal**: Provide essential inventory insights without over-engineering

This strategy balances business needs with implementation simplicity, providing a solid foundation for future enhancements while delivering immediate value to users. 