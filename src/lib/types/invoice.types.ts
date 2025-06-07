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
  discountAmount?: Decimal | null;
  discountPercent?: Decimal | null;
  itemId?: UUID; // Link to InventoryItem
  // Potentially link back to OrderItem if needed
  // orderItemId?: UUID;
  // inventoryItemId?: UUID; // Alternative naming for itemId
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
  vatReverseCharge: boolean;
  notes?: string;
  paymentDate?: Date | null; // Date when payment was recorded
  paidAmount?: Decimal | null; // Total amount paid
  creditedAmount?: Decimal | null; // Total amount credited
  isCreditNote?: boolean; // True if this invoice is a credit note
  sentAt?: Date | null; // Timestamp when the invoice was marked as sent
  pdfUrl?: string | null; // Link to a generated PDF
  companyId?: UUID | null; // Link to the company this invoice belongs to
  userId?: UUID | null; // Link to the user who created/owns this invoice
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
  discountAmount?: number | null;
  discountPercent?: number | null;
}

// Input types for creation/update will be added as needed with Zod schemas 