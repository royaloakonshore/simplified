import { z } from 'zod';

export const BillOfMaterialItemSchema = z.object({
  id: z.string().cuid().optional(), // For existing items during update
  componentItemId: z.string().cuid({ message: 'Component Item ID is required.' }),
  quantity: z.number().positive({ message: 'Quantity must be positive.' }),
});

export type BillOfMaterialItemInput = z.infer<typeof BillOfMaterialItemSchema>;

export const UpsertBillOfMaterialSchema = z.object({
  id: z.string().cuid().optional(), // If updating an existing BOM
  name: z.string().min(1, { message: 'BOM name is required.' }),
  description: z.string().optional().nullable(),
  manualLaborCost: z.number().nonnegative({ message: 'Manual labor cost cannot be negative.' }).default(0),
  manufacturedItemId: z.string().cuid({ message: 'Manufactured Item ID is required.' }), // The InventoryItem this BOM is for
  items: z.array(BillOfMaterialItemSchema).min(1, { message: 'BOM must have at least one component item.' }),
  companyId: z.string().cuid({ message: 'Company ID is required.' }), // Assuming companyId is passed for now
});

export type UpsertBillOfMaterialInput = z.infer<typeof UpsertBillOfMaterialSchema>;

// Schema for fetching a single BOM
export const GetBillOfMaterialSchema = z.object({
  id: z.string().cuid(),
});

// Schema for listing BOMs (basic, can be expanded with filters/pagination)
export const ListBillOfMaterialsSchema = z.object({
  manufacturedItemId: z.string().cuid().optional(),
  companyId: z.string().cuid({ message: 'Company ID is required.'}),
  // Add pagination/sorting later if needed
}); 