# Next Steps Guide - Line Item Enhancements

This guide provides detailed steps for implementing the next priority feature: Line Item Enhancements for Orders and Invoices (discounts and VAT handling).

## Background

Currently, Order and Invoice items are simple with only quantity and unit price. The requirements call for:

1. Adding discount capabilities to both OrderItems and InvoiceItems
2. Adding VAT handling to InvoiceItems, including a VAT reverse charge option

## Implementation Plan

### 1. Schema Changes

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

#### Update TypeScript Types

1. Update related types in `src/lib/types/order.types.ts` and `src/lib/types/invoice.types.ts`
2. Consider adding a Finnish VAT rates enum/constant for common VAT rates (24%, 14%, 10%, 0%)

### 2. Update Zod Schemas

#### Order Schemas

Update `src/lib/schemas/order.schema.ts`:

```typescript
export const orderItemSchema = z.object({
  // ... existing fields
  discountAmount: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
});
```

#### Invoice Schemas

Update `src/lib/schemas/invoice.schema.ts`:

```typescript
export const invoiceSchema = z.object({
  // ... existing fields
  vatReverseCharge: z.boolean().default(false),
  // ... other fields
});

export const invoiceItemSchema = z.object({
  // ... existing fields
  discountAmount: z.number().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  vatRatePercent: z.number().min(0).max(100).default(24), // Default to standard Finnish VAT
});

// Consider adding Finnish VAT constants
export const FINNISH_VAT_RATES = [24, 14, 10, 0] as const;
```

### 3. Update Calculation Logic

#### Order Total Calculation

Update the total calculation in `src/lib/api/routers/order.ts` to account for discounts:

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

#### Invoice Total Calculation

Update the calculation in `src/lib/actions/invoice.actions.ts` to account for discounts and VAT handling:

```typescript
function calculateSubTotal(items: { quantity: number | Decimal, unitPrice: number | Decimal, discountAmount?: number | Decimal, discountPercent?: number | Decimal }[]): Decimal {
  return items.reduce((sum, item) => {
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
    
    return new Decimal(sum.toString()).plus(discountedTotal);
  }, new Decimal(0));
}

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

### 4. Update UI Components

#### OrderForm.tsx

Update `src/components/orders/OrderForm.tsx` to include discount fields:

```tsx
// In your table row for order items
<TableRow key={field.key}>
  {/* ... existing fields */}
  <TableCell>
    <FormField
      control={form.control}
      name={`items.${index}.discountPercent`}
      render={({ field: discountField }) => (
        <FormItem>
          <FormControl><Input type="number" step="0.01" {...discountField} onChange={e => discountField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl>
          <FormDescription>%</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </TableCell>
  <TableCell>
    <FormField
      control={form.control}
      name={`items.${index}.discountAmount`}
      render={({ field: discountField }) => (
        <FormItem>
          <FormControl><Input type="number" step="0.01" {...discountField} onChange={e => discountField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl>
          <FormDescription>{formatCurrency(Number(discountField.value) || 0)}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </TableCell>
  {/* ... remaining cells */}
</TableRow>
```

#### InvoiceForm.tsx

Update `src/components/invoices/InvoiceForm.tsx` to include discount fields and VAT handling:

```tsx
// Add VAT reverse charge checkbox
<FormField
  control={form.control}
  name="vatReverseCharge"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
      <FormControl>
        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>VAT Reverse Charge</FormLabel>
        <FormDescription>
          Enable this for reverse charge VAT transactions (e.g., for intra-EU B2B sales).
          All line items will have 0% VAT when this is enabled.
        </FormDescription>
      </div>
    </FormItem>
  )}
/>

// Update VAT handling in item rows to respect reverse charge
// In your table row for invoice items
<TableRow key={field.key}>
  {/* ... existing fields */}
  <TableCell>
    <FormField
      control={form.control}
      name={`items.${index}.vatRatePercent`}
      render={({ field: vatField }) => (
        <FormItem>
          <FormControl>
            <Select 
              onValueChange={(v) => vatField.onChange(parseFloat(v))} 
              defaultValue={vatField.value?.toString()} 
              disabled={form.watch('vatReverseCharge')}
            >
              <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
              <SelectContent>
                {FINNISH_VAT_RATES.map(rate => 
                  <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                )}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </TableCell>
  {/* Add discount fields similar to OrderForm */}
  {/* ... remaining cells */}
</TableRow>
```

### 5. Update Finvoice Generation

Update `src/lib/services/finvoice.service.ts` to handle discounts and VAT reverse charge:

```typescript
// In the Finvoice XML generation function
// For each row/item
const rowElement = rowsElement.ele('InvoiceRow');

// ... existing row details

// Add discount information if present
if (item.discountPercent) {
  rowElement.ele('RowDiscountPercent').txt(formatDecimal(item.discountPercent)).up();
}
if (item.discountAmount) {
  rowElement.ele('RowDiscountAmount').txt(formatDecimal(item.discountAmount)).up();
}

// Handle VAT reverse charge
if (invoice.vatReverseCharge) {
  // Add VAT exemption reason code and text for reverse charge
  rowElement.ele('RowVatRatePercent').txt('0').up();
  rowElement.ele('RowVatCode').txt('AE').up(); // AE = VAT Reverse Charge
  rowElement.ele('RowFreeText').txt('Käännetty verovelvollisuus / VAT Reverse Charge').up();
} else {
  rowElement.ele('RowVatRatePercent').txt(formatDecimal(item.vatRatePercent)).up();
}
```

## Migration Plan

1. Create a migration for the new fields:
   ```bash
   npx prisma migrate dev --name add_discount_and_vat_fields
   ```

2. Implement the schema changes in order of dependency:
   - First update Prisma schema
   - Generate Prisma client
   - Update TypeScript types and Zod schemas
   - Implement calculation logic updates
   - Finally update UI components

## Testing Recommendations

1. Test discount calculations with different combinations of discountAmount and discountPercent
2. Verify that only one discount type (amount or percent) can be applied to a single line item
3. Test VAT reverse charge functionality and ensure:
   - All line items show 0% VAT when enabled
   - The correct Finvoice codes are generated
   - Totals are calculated correctly
4. Test the interaction between discounts and VAT calculations
5. Verify that existing orders and invoices are still displayed correctly 