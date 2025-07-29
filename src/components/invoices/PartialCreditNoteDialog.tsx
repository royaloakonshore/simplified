"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { Decimal } from "@prisma/client/runtime/library";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { CreatePartialCreditNoteSchema, type CreatePartialCreditNoteInput } from "@/lib/schemas/credit-note.schema";
import { api } from "@/lib/trpc/react";
import type { Invoice } from "@/lib/types/invoice.types";

interface PartialCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSuccess?: (creditNoteId: string) => void;
}

export function PartialCreditNoteDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: PartialCreditNoteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createPartialCreditNoteMutation = api.invoice.createPartialCreditNote.useMutation({
    onSuccess: (creditNote) => {
      toast.success(`Partial credit note created: ${creditNote.invoiceNumber}`);
      onSuccess?.(creditNote.id);
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(`Failed to create credit note: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  // Calculate line totals for each item
  const calculateLineTotal = (quantity: number, unitPrice: number, discountAmount?: number, discountPercentage?: number) => {
    let lineTotal = quantity * unitPrice;
    
    if (discountAmount) {
      lineTotal -= discountAmount;
    }
    
    if (discountPercentage) {
      lineTotal -= (lineTotal * discountPercentage) / 100;
    }
    
    return Math.max(0, lineTotal);
  };

  // Calculate VAT amount for a line
  const calculateVatAmount = (lineTotal: number, vatRate: number) => {
    return (lineTotal * vatRate) / 100;
  };

  // Initialize form with invoice items
  const form = useForm<CreatePartialCreditNoteInput>({
    resolver: zodResolver(CreatePartialCreditNoteSchema),
    defaultValues: {
      originalInvoiceId: invoice.id,
      notes: `Partial credit note for invoice ${invoice.invoiceNumber}`,
      items: invoice.items.map((item) => {
        const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) : parseFloat(item.quantity.toString());
        const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : parseFloat(item.unitPrice.toString());
        const vatRate = typeof item.vatRatePercent === 'string' ? parseFloat(item.vatRatePercent) : parseFloat(item.vatRatePercent.toString());
        const discountAmount = item.discountAmount ? (typeof item.discountAmount === 'string' ? parseFloat(item.discountAmount) : parseFloat(item.discountAmount.toString())) : undefined;
        const discountPercentage = item.discountPercent ? (typeof item.discountPercent === 'string' ? parseFloat(item.discountPercent) : parseFloat(item.discountPercent.toString())) : undefined;
        
        const lineTotal = calculateLineTotal(quantity, unitPrice, discountAmount, discountPercentage);
        const vatAmount = calculateVatAmount(lineTotal, vatRate);
        
        return {
          originalItemId: item.id,
          description: item.description,
          originalQuantity: quantity,
          originalUnitPrice: unitPrice,
          originalVatRatePercent: vatRate,
          originalDiscountAmount: discountAmount || null,
          originalDiscountPercentage: discountPercentage || null,
          creditAmount: lineTotal, // Default to full line amount
          creditVatAmount: vatAmount, // Default to full VAT amount
        };
      }),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const onSubmit = async (data: CreatePartialCreditNoteInput) => {
    setIsSubmitting(true);
    try {
      await createPartialCreditNoteMutation.mutateAsync(data);
    } catch (error) {
      // Error handling is done in the mutation
      setIsSubmitting(false);
    }
  };

  // Calculate totals
  const watchedItems = form.watch("items");
  const totalCreditAmount = watchedItems.reduce((sum, item) => sum + (item.creditAmount || 0), 0);
  const totalCreditVatAmount = watchedItems.reduce((sum, item) => sum + (item.creditVatAmount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Partial Credit Note</DialogTitle>
          <DialogDescription>
            Create a partial credit note for invoice {invoice.invoiceNumber}. 
            Edit the euro amounts you want to credit for each line item.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Notes field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes for this credit note..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line items */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Line Items</h3>
              {fields.map((field, index) => {
                const item = watchedItems[index];
                const originalLineTotal = calculateLineTotal(
                  item.originalQuantity,
                  item.originalUnitPrice,
                  item.originalDiscountAmount || undefined,
                  item.originalDiscountPercentage || undefined
                );
                const originalVatAmount = calculateVatAmount(originalLineTotal, item.originalVatRatePercent);

                return (
                  <Card key={field.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{item.description}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Original amounts (read-only) */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">Original Line Total</p>
                          <p className="text-lg">€{originalLineTotal.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Original VAT Amount</p>
                          <p className="text-lg">€{originalVatAmount.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Editable credit amounts */}
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.creditAmount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit Amount (€)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={originalLineTotal}
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    // Auto-calculate VAT amount
                                    const vatAmount = calculateVatAmount(value, item.originalVatRatePercent);
                                    form.setValue(`items.${index}.creditVatAmount`, vatAmount);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.creditVatAmount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit VAT Amount (€)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={originalVatAmount}
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Credit Amount:</span>
                <span>€{totalCreditAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Credit VAT:</span>
                <span>€{totalCreditVatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-2">
                <span>Total Credit (incl. VAT):</span>
                <span>€{(totalCreditAmount + totalCreditVatAmount).toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || totalCreditAmount <= 0}
              >
                {isSubmitting ? "Creating..." : "Create Credit Note"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
