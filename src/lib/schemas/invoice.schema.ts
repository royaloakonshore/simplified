import { z } from 'zod';
// import { InvoiceStatus } from '@/lib/types/invoice.types'; // Comment out local enum import
import { InvoiceStatus } from '@prisma/client'; // Import Prisma enum

// Base schema for Invoice Item Input
const invoiceItemInputSchema = z.object({
  itemId: z.string().uuid("Valid Inventory Item ID is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
  vatRatePercent: z.number().min(0).max(100, "VAT rate must be between 0 and 100"),
  // Optional links - adjust if needed
  // orderItemId: z.string().uuid().optional(),
  // inventoryItemId: z.string().uuid().optional(),
});

// Schema for creating an invoice from an order
export const createInvoiceFromOrderSchema = z.object({
  orderId: z.string().uuid("Valid Order ID is required"),
  invoiceDate: z.coerce.date().optional().default(() => new Date()), // Default to today
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
});

// Schema for creating a manual invoice
export const createManualInvoiceSchema = z.object({
  customerId: z.string().uuid("Valid Customer ID is required"),
  invoiceDate: z.coerce.date().optional().default(() => new Date()),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
  items: z.array(invoiceItemInputSchema).min(1, "At least one invoice item is required"),
});

// Schema for updating invoice status
export const updateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus), // Use Prisma enum here
});

// Schema for recording payment
export const recordPaymentSchema = z.object({
  paymentDate: z.coerce.date().optional().default(() => new Date()),
  // amount: z.number().positive().optional(), // Could add partial payments later
});

// Basic filter schema (expand as needed)
export const invoiceFilterSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(), // Use Prisma enum here
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  searchTerm: z.string().optional(),
}).partial();

// Pagination schema (similar to orders)
export const invoicePaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().optional().default(10),
  sortBy: z.string().optional().default('invoiceDate'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
}); 