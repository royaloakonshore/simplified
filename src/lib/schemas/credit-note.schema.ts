import { z } from 'zod';

// Schema for partial credit note item
export const PartialCreditNoteItemSchema = z.object({
  originalItemId: z.string().cuid({ message: "Original item ID is required" }),
  description: z.string().min(1, "Description is required"),
  originalQuantity: z.number().positive("Original quantity must be positive"),
  originalUnitPrice: z.number().nonnegative("Original unit price cannot be negative"),
  originalVatRatePercent: z.number().min(0).max(100, "VAT rate must be between 0 and 100"),
  originalDiscountAmount: z.number().nonnegative().optional().nullable(),
  originalDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  
  // Editable credit amounts (in euros)
  creditAmount: z.number().min(0, "Credit amount cannot be negative"),
  creditVatAmount: z.number().min(0, "Credit VAT amount cannot be negative"),
});

// Schema for creating a partial credit note
export const CreatePartialCreditNoteSchema = z.object({
  originalInvoiceId: z.string().cuid({ message: "Original invoice ID is required" }),
  notes: z.string().optional(),
  items: z
    .array(PartialCreditNoteItemSchema)
    .min(1, "At least one item must be included in the credit note"),
});

// Type inference
export type PartialCreditNoteItemInput = z.infer<typeof PartialCreditNoteItemSchema>;
export type CreatePartialCreditNoteInput = z.infer<typeof CreatePartialCreditNoteSchema>;
