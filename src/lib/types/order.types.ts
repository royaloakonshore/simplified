import { Customer } from "./customer.types";
import { InventoryItem } from "./inventory.types";
import { UUID, Decimal, createUUID } from "./branded";

/**
 * OrderStatus enum matching the Prisma schema
 * Defines the lifecycle of an order
 */
export enum OrderStatus {
  DRAFT = "draft",
  CONFIRMED = "confirmed",
  IN_PRODUCTION = "in_production",
  SHIPPED = "shipped",
  DELIVERED = "delivered", // Note: UI displays this as "Ready to Invoice"
  CANCELLED = "cancelled",
  INVOICED = "invoiced",
}

/**
 * Core OrderItem type
 * Represents a line item in an order with quantity and price
 */
export interface OrderItem {
  id: UUID;
  orderId: UUID;
  itemId: UUID;
  quantity: Decimal;
  unitPrice: Decimal;
  discountAmount?: Decimal | null;
  discountPercent?: Decimal | null;
  item: InventoryItem;
}

/**
 * New OrderItem input type for creating order items
 */
export interface OrderItemInput {
  itemId: string;
  quantity: number;
  unitPrice?: number; // Optional, can be calculated from item.salesPrice
  discountAmount?: number | null;
  discountPercent?: number | null;
}

/**
 * Core Order type
 * Represents an order with customer, status, and items
 */
export interface Order {
  id: UUID;
  customerId: UUID;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: Decimal;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  customer: Customer;
  items: OrderItem[];
}

/**
 * New Order input type for creating orders
 */
export interface OrderInput {
  customerId: string;
  notes?: string;
  items?: OrderItemInput[];
}

/**
 * Order update input type
 */
export interface OrderUpdateInput {
  notes?: string;
}

/**
 * Type for order status update
 */
export interface OrderStatusUpdateInput {
  status: OrderStatus;
}

/**
 * Order with calculated stock status
 * Includes information about whether items are in stock
 */
export interface OrderWithStockStatus extends Order {
  hasInsufficientStock: boolean;
  outOfStockItems?: {
    itemId: UUID;
    name: string;
    quantityRequested: Decimal;
    quantityAvailable: Decimal;
  }[];
} 