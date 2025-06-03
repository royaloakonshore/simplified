import { z } from 'zod';

export const inventoryCategoryBaseSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  companyId: z.string().cuid('Company ID is required'),
});

export const createInventoryCategorySchema = inventoryCategoryBaseSchema;

export const updateInventoryCategorySchema = inventoryCategoryBaseSchema.partial().extend({
  id: z.string().cuid('Category ID is required'),
});

export const listInventoryCategoriesSchema = z.object({
  companyId: z.string().cuid('Company ID is required'),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateInventoryCategoryInput = z.infer<typeof createInventoryCategorySchema>;
export type UpdateInventoryCategoryInput = z.infer<typeof updateInventoryCategorySchema>;
export type ListInventoryCategoriesInput = z.infer<typeof listInventoryCategoriesSchema>; 