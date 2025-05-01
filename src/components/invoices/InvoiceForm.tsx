"use client";

import { type Customer, type InventoryItem } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// TODO: Add imports for react-hook-form, zod, schemas, tRPC, etc.

type InvoiceFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure'>[];
  // invoice?: Invoice & { items: ... }; // Add type for edit mode later
  isEditMode: boolean;
};

export default function InvoiceForm({ customers, inventoryItems, isEditMode }: InvoiceFormProps) {
  // TODO: Setup react-hook-form instance (useForm)
  // TODO: Setup field array for items (useFieldArray)
  // TODO: Define submit handler (onSubmit)
  // TODO: Setup tRPC mutations (createInvoice, updateInvoice)

  const title = isEditMode ? "Edit Invoice" : "Create New Invoice";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p>Invoice form fields will go here...</p>
        {/* Placeholder for Customer Select */}
        <div>
          <label>Customer:</label>
          <select disabled={isEditMode}>
            <option value="">Select Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Placeholder for Items Table */}
        <div>
          <p>Items Table...</p>
        </div>

        {/* Placeholder for Notes */}
        <div>
           <label>Notes:</label>
           <textarea />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
         <Button type="submit" disabled={true /* TODO: Link to form state */}>
           {isEditMode ? "Save Changes" : "Create Invoice"}
         </Button>
      </CardFooter>
    </Card>
  );
} 