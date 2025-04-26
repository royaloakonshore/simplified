import { z } from 'zod';
import { MaterialType, TransactionType } from '../types/inventory.types';

// Schema for inventory item validation
export const inventoryItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required'),
  costPrice: z.coerce.number().min(0, 'Cost price must be a positive number'),
  salesPrice: z.coerce.number().min(0, 'Sales price must be a positive number'),
  materialType: z.nativeEnum(MaterialType, {
    errorMap: () => ({ message: 'Invalid material type' }),
  }),
  minimumStockLevel: z.coerce.number().min(0, 'Minimum stock level must be a positive number'),
  reorderLevel: z.coerce.number().min(0, 'Reorder level must be a positive number'),
});

// Schema for inventory item creation
export const createInventoryItemSchema = inventoryItemSchema;

// Schema for inventory item update
export const updateInventoryItemSchema = z.object({
  id: z.string(),
  ...inventoryItemSchema.shape,
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

// Schema for stock adjustment
export const stockAdjustmentSchema = z.object({
  itemId: z.string(),
  quantity: z.coerce.number().refine(val => val !== 0, {
    message: 'Quantity cannot be zero',
  }),
  note: z.string().nullable().optional(),
});

// Schema for bulk stock adjustment
export const bulkStockAdjustmentSchema = z.array(stockAdjustmentSchema);

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
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type BulkStockAdjustmentInput = z.infer<typeof bulkStockAdjustmentSchema>;
export type ListInventoryItemsInput = z.infer<typeof listInventoryItemsSchema>; 