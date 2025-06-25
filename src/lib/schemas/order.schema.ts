// NOTE: Removed 'use client' directive as schemas are used server-side in tRPC.

import { z } from "zod";
import { OrderStatus, OrderType } from "@prisma/client"; // Import OrderStatus and OrderType enums from Prisma

// VAT rates for order items (same as invoice)
export const FINNISH_VAT_RATES = [25.5, 14, 10, 0] as const;
export type FinnishVatRate = (typeof FINNISH_VAT_RATES)[number];

/**
 * Base for individual order item input, used in create and update schemas
 */
export const orderItemBaseSchema = z.object({
  id: z.string().optional(), // Optional: used for identifying existing items if needed, not directly by Prisma create
  inventoryItemId: z.string().cuid('Invalid inventory item ID'), // CHANGED from itemId
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
  vatRatePercent: z.coerce.number().min(0).max(100, 'VAT rate must be between 0 and 100').default(25.5), // Add VAT rate
  discountAmount: z.coerce.number().nonnegative('Discount amount must be non-negative').nullable().optional(),
  discountPercent: z.coerce.number().min(0).max(100, 'Discount percent must be between 0 and 100').nullable().optional(),
  rowFreeText: z.string().optional(), // Additional description/notes for the row
});

export type OrderItemInput = z.infer<typeof orderItemBaseSchema>;

/**
 * Base schema for Order fields
 */
export const orderBaseSchema = z.object({
  customerId: z.string().cuid({ message: 'Customer must be selected' }),
  orderNumber: z.string().optional(), // Consider auto-generating this
  status: z.nativeEnum(OrderStatus).default(OrderStatus.draft),
  orderType: z.nativeEnum(OrderType).default(OrderType.work_order), // Add orderType field
  deliveryDate: z.coerce.date().optional().nullable(), // Added deliveryDate
  notes: z.string().optional(),
  items: z.array(orderItemBaseSchema).min(1, 'Order must have at least one item'),
  // totalAmount will likely be calculated on the server, not submitted by client
});

/**
 * Schema for creating an order
 */
export const createOrderSchema = z.object({
  customerId: z.string().cuid('Invalid customer ID'),
  orderDate: z.date().optional().default(() => new Date()),
  deliveryDate: z.date().nullable().optional(),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.draft),
  orderType: z.nativeEnum(OrderType).default(OrderType.work_order),
  notes: z.string().nullable().optional(),
  items: z.array(orderItemBaseSchema).min(1, 'Order must have at least one item'),
});

/**
 * Schema for updating an order
 */
export const updateOrderSchema = z.object({
  id: z.string().cuid(),
  customerId: z.string().cuid('Invalid customer ID').optional(),
  orderDate: z.date().optional(),
  deliveryDate: z.date().nullable().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  orderType: z.nativeEnum(OrderType).optional(),
  notes: z.string().nullable().optional(),
  // Items are optional for update; if provided, they might replace existing items
  items: z.array(orderItemBaseSchema).min(1, 'Order must have at least one item').optional(),
});

/**
 * Schema for order status updates
 */
export const updateOrderStatusSchema = z.object({
    id: z.string().cuid(),
    status: z.nativeEnum(OrderStatus),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Filter schema for listing orders
 */
export const orderFilterSchema = z.object({
  customerId: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  orderType: z.nativeEnum(OrderType).optional(), // Add orderType filter
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  searchTerm: z.string().optional(),
});

/**
 * Pagination schema for orders listing
 */
export const orderPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(10),
  sortBy: z
    .enum(["createdAt", "orderNumber", "status", "orderType", "totalAmount"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Schema for Order list filtering and pagination (Example)
 */
export const listOrdersSchema = z.object({
  limit: z.number().min(1).max(100).nullish(),
  cursor: z.string().nullish(),
  customerId: z.string().cuid().optional(),
  status: z.nativeEnum(OrderStatus).nullish(),
  orderType: z.nativeEnum(OrderType).nullish(), // Add orderType filter
  // Add other filters: date range, search term?
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

// Zod schema for listProductionView input (initially empty, can be expanded)
export const listProductionViewInputSchema = z.object({
  // placeholder for future filters like specific statuses, assigned user, etc.
  // limit: z.number().min(1).max(100).nullish(),
  // cursor: z.string().cuid().nullish(),
});

export type ListProductionViewInput = z.infer<typeof listProductionViewInputSchema>; // Exporting the type as well

/**
 * Schema for deleting multiple orders
 */
export const deleteManyOrdersSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "At least one order ID must be provided."),
});
export type DeleteManyOrdersInput = z.infer<typeof deleteManyOrdersSchema>;

/**
 * Schema for sending multiple orders to production
 */
export const sendManyOrdersToProductionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "At least one order ID must be provided."),
});
export type SendManyOrdersToProductionInput = z.infer<typeof sendManyOrdersToProductionSchema>; 