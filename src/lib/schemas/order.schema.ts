import { z } from "zod";
import { OrderStatus } from "../types/order.types";

/**
 * Schema for order item validation
 */
export const orderItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  quantity: z.coerce
    .number()
    .positive("Quantity must be a positive number"),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price must be zero or positive")
    .optional(),
});

/**
 * Schema for creating new orders
 */
export const createOrderSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).optional(),
});

/**
 * Schema for updating existing orders
 */
export const updateOrderSchema = z.object({
  notes: z.string().optional(),
});

/**
 * Schema for order status updates
 */
export const orderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: "Invalid order status" }),
  }),
});

/**
 * Schema for adding items to an existing order
 */
export const addOrderItemSchema = orderItemSchema;

/**
 * Schema for updating items in an existing order
 */
export const updateOrderItemSchema = z.object({
  quantity: z.coerce
    .number()
    .positive("Quantity must be a positive number"),
  unitPrice: z.coerce
    .number()
    .nonnegative("Unit price must be zero or positive")
    .optional(),
});

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