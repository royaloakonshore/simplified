import { z } from 'zod';
import { MaterialType, TransactionType } from '../types/inventory.types';
import { MaterialType as PrismaMaterialType } from '@prisma/client'; // Import enum from Prisma Client

// Base schema for inventory item fields
export const inventoryItemBaseSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Unit of Measure is required').optional().default('kpl'),
  costPrice: z.coerce
    .number({ invalid_type_error: 'Cost price must be a number' })
    .nonnegative('Cost price must be non-negative'),
  salesPrice: z.coerce
    .number({ invalid_type_error: 'Sales price must be a number' })
    .nonnegative('Sales price must be non-negative'),
  materialType: z.nativeEnum(PrismaMaterialType).optional().default(PrismaMaterialType.raw_material),
  minimumStockLevel: z.coerce
    .number({ invalid_type_error: 'Min stock level must be a number' })
    .nonnegative('Min stock level must be non-negative')
    .optional()
    .default(0),
  reorderLevel: z.coerce
    .number({ invalid_type_error: 'Reorder level must be a number' })
    .nonnegative('Reorder level must be non-negative')
    .optional()
    .default(0),
});

// Schema for creating an inventory item
export const createInventoryItemSchema = inventoryItemBaseSchema;

// Schema for updating an inventory item (requires ID)
export const updateInventoryItemSchema = inventoryItemBaseSchema.extend({
  id: z.string(),
});

// Schema for inventory transaction
export const inventoryTransactionSchema = z.object({
  itemId: z.string(),
  quantity: z.coerce.number().refine(val => val !== 0, {
    message: 'Quantity cannot be zero',
  }),
  type: z.nativeEnum(TransactionType, {
    errorMap: () => ({ message: 'Invalid transaction type' }),
  }),
  reference: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

// Schema for adjusting stock
export const adjustStockSchema = z.object({
    itemId: z.string(),
    quantityChange: z.preprocess(
        (val) => (typeof val === 'string' ? parseFloat(val) : val),
        z.number({ invalid_type_error: 'Quantity change must be a number' })
    ),
    // Optional: Add type (purchase, sale, adjustment) and reference if needed
    note: z.string().optional(),
});

// Schema for inventory list filtering and pagination
export const listInventoryItemsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  materialType: z.nativeEnum(MaterialType).optional(),
  sortBy: z.enum(['sku', 'name', 'quantityOnHand', 'costPrice', 'createdAt']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

// Type inference
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListInventoryItemsInput = z.infer<typeof listInventoryItemsSchema>;

// Exporting the inferred type for form values
export type InventoryItemFormValues = z.infer<typeof inventoryItemBaseSchema>; 