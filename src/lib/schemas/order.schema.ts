'use client'; // NOTE: Added 'use client' based on user feedback, but schemas are usually server-side. Re-evaluate if needed.

import { z } from "zod";
import { OrderStatus } from "@prisma/client"; // Import OrderStatus enum from Prisma

/**
 * Schema for order item validation
 */
export const orderItemSchema = z.object({
  id: z.string().cuid().optional(), // Optional for creation
  orderId: z.string().cuid().optional(), // Optional, will be set when linked to Order
  itemId: z.string().cuid({ message: 'Inventory item must be selected' }),
  quantity: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number({ invalid_type_error: 'Quantity must be a number' })
       .int({ message: 'Quantity must be a whole number' })
       .positive({ message: 'Quantity must be positive' })
  ),
  pricePerUnit: z.preprocess( // Price at the time of order
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number({ invalid_type_error: 'Price must be a number' })
       .nonnegative({ message: 'Price cannot be negative' })
  ),
  // Optional: Add other fields if needed, like discounts specific to the line item
});

/**
 * Base schema for Order fields
 */
export const orderBaseSchema = z.object({
  customerId: z.string().cuid({ message: 'Customer must be selected' }),
  orderNumber: z.string().optional(), // Consider auto-generating this
  status: z.nativeEnum(OrderStatus).default(OrderStatus.draft),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  // totalAmount will likely be calculated on the server, not submitted by client
});

/**
 * Schema for creating new orders
 */
export const createOrderSchema = orderBaseSchema;

/**
 * Schema for updating existing orders
 */
export const updateOrderSchema = orderBaseSchema.extend({
  id: z.string().cuid(),
  // Allow updating specific fields like status, notes, maybe items
  // Exclude fields that shouldn't be updated directly (e.g., orderNumber, customerId?)
}).partial({ // Make fields optional for update, except ID
  customerId: true,
  status: true,
  notes: true,
  items: true,
});

/**
 * Schema for order status updates
 */
export const updateOrderStatusSchema = z.object({
    id: z.string().cuid(),
    status: z.nativeEnum(OrderStatus),
});

/**
 * Type inference for use in forms and procedures
 */
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Filter schema for listing orders
 */
export const orderFilterSchema = z.object({
  customerId: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
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
    .enum(["createdAt", "orderNumber", "status", "totalAmount"])
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
  status: z.nativeEnum(OrderStatus).optional(),
  // Add other filters: date range, search term?
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>; 