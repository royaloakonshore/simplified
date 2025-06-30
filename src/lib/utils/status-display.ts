/**
 * Shared utilities for status display across the application
 * Provides consistent user-friendly status names and badge styling
 */

import { OrderStatus } from "@/lib/types/order.types";
import { InvoiceStatus } from "@/lib/types/invoice.types";
import { OrderStatus as PrismaOrderStatus, InvoiceStatus as PrismaInvoiceStatus } from "@prisma/client";

// Order Status Display Functions
export const getOrderStatusDisplayText = (status: OrderStatus | PrismaOrderStatus | string): string => {
  const statusStr = String(status);
  switch (statusStr) {
    case "draft":
      return "DRAFT";
    case "confirmed":
      return "CONFIRMED";
    case "in_production":
      return "IN PROD.";
    case "shipped":
      return "SHIPPED";
    case "delivered":
      return "READY TO INVOICE";
    case "cancelled":
      return "CANCELLED";
    case "invoiced":
      return "INVOICED";
    default:
      return statusStr.replace('_', ' ').toUpperCase();
  }
};

export const getOrderStatusBadgeVariant = (status: OrderStatus | PrismaOrderStatus | string): "default" | "secondary" | "destructive" | "outline" => {
  const statusStr = String(status);
  switch (statusStr) {
    case "draft":
      return "secondary";
    case "confirmed":
    case "in_production":
      return "default";
    case "shipped":
    case "delivered":
    case "invoiced":
      return "outline";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
};

// Invoice Status Display Functions
export const getInvoiceStatusDisplayText = (status: InvoiceStatus | PrismaInvoiceStatus | string): string => {
  const statusStr = String(status);
  switch (statusStr) {
    case "draft":
      return "DRAFT";
    case "sent":
      return "SENT";
    case "paid":
      return "PAID";
    case "overdue":
      return "OVERDUE";
    case "cancelled":
      return "CANCELLED";
    case "credited":
      return "CREDITED";
    default:
      return statusStr.replace('_', ' ').toUpperCase();
  }
};

export const getInvoiceStatusBadgeVariant = (status: InvoiceStatus | PrismaInvoiceStatus | string): "default" | "secondary" | "destructive" | "outline" => {
  const statusStr = String(status);
  switch (statusStr) {
    case "paid":
      return "default";
    case "sent":
      return "default";
    case "overdue":
    case "cancelled":
      return "destructive";
    case "draft":
    case "credited":
      return "secondary";
    default:
      return "outline";
  }
}; 