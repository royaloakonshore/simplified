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
  manualLaborCost: z.number().nonnegative({ message: 'Manual labor cost cannot be negative.' }),
  manufacturedItemId: z.string().cuid({ message: 'Manufactured Item ID is required.' }).optional().nullable(), // Made optional and nullable
  items: z.array(BillOfMaterialItemSchema).min(1, { message: 'BOM must have at least one component item.' }),
  // Removed companyId as it will come from tRPC context
});

export type UpsertBillOfMaterialInput = z.infer<typeof UpsertBillOfMaterialSchema>;

// Schema for fetching a single BOM
export const GetBillOfMaterialSchema = z.object({
  id: z.string().cuid(),
  companyId: z.string().cuid().optional(), // Added optional companyId for scoping
});

// Schema for listing BOMs (basic, can be expanded with filters/pagination)
export const ListBillOfMaterialsSchema = z.object({
  manufacturedItemId: z.string().cuid().optional().nullable(), // Allow null to explicitly search for BOMs not linked to a manufactured item
  companyId: z.string().cuid({ message: 'Company ID is required.'}),
  // Add pagination/sorting later if needed
}); 