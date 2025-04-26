import { Customer } from "./customer.types";
import { Order } from "./order.types";
import { UUID, Decimal } from "./branded";

/**
 * InvoiceStatus enum matching the Prisma schema
 * Defines the lifecycle of an invoice
 */
export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
  CREDITED = "credited",
}

/**
 * Core InvoiceItem type
 * Represents a line item in an invoice
 */
export interface InvoiceItem {
  id: UUID;
  invoiceId: UUID;
  description: string; // Can be derived from OrderItem/InventoryItem or entered manually
  quantity: Decimal;
  unitPrice: Decimal;
  vatRatePercent: Decimal; // VAT percentage for this line item
  // Potentially link back to OrderItem or InventoryItem if needed
  // orderItemId?: UUID;
  // inventoryItemId?: UUID;
}

/**
 * Core Invoice type
 * Represents an invoice with customer, status, items, and payment details
 */
export interface Invoice {
  id: UUID;
  customerId: UUID;
  orderId?: UUID | null; // Optional link to the original order
  invoiceNumber: string; // Unique invoice number
  invoiceDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  totalAmount: Decimal; // Total including VAT
  totalVatAmount: Decimal; // Total VAT amount
  notes?: string;
  paymentDate?: Date | null; // Date when payment was recorded
  createdAt: Date;
  updatedAt: Date;
  customer: Customer;
  items: InvoiceItem[];
  order?: Order | null;
  
  // Links for Credit Notes
  originalInvoiceId?: UUID | null;
  creditNoteId?: UUID | null;
  originalInvoice?: Invoice | null; // Relation placeholder
  creditNote?: Invoice | null;    // Relation placeholder
}

/**
 * Manual Invoice Item Input type
 * Represents the input for creating a manual invoice item
 */
export interface ManualInvoiceItemInput {
  itemId: string; // Add itemId
  description: string;
  quantity: number;
  unitPrice: number;
  vatRatePercent: number;
}

// Input types for creation/update will be added as needed with Zod schemas 