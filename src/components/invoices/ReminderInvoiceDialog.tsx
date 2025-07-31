"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { parseNordicNumber, formatNordicNumber } from "@/lib/utils/nordic-numbers";

interface ReminderInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    penaltyInterest?: number | null;
    dueDate: string;
    customerId: string;
  };
}

export function ReminderInvoiceDialog({
  open,
  onOpenChange,
  invoice,
}: ReminderInvoiceDialogProps) {
  const router = useRouter();
  const [includePenaltyInterest, setIncludePenaltyInterest] = useState(false);
  const [includeReminderFee, setIncludeReminderFee] = useState(true);
  const [reminderFeeAmount, setReminderFeeAmount] = useState("10,00");
  const [isCreating, setIsCreating] = useState(false);

  const createReminderMutation = api.invoice.createReminder.useMutation({
    onSuccess: (reminderInvoice) => {
      toast.success("Reminder invoice created successfully");
      onOpenChange(false);
      router.push(`/invoices/${reminderInvoice.id}/edit`);
    },
    onError: (error) => {
      toast.error(`Failed to create reminder invoice: ${error.message}`);
    },
  });

  const handleCreateReminder = async () => {
    setIsCreating(true);
    
    try {
      const reminderFeeAmountNumber = includeReminderFee 
        ? parseNordicNumber(reminderFeeAmount) 
        : 0;

      await createReminderMutation.mutateAsync({
        originalInvoiceId: invoice.id,
        includePenaltyInterest,
        includeReminderFee,
        reminderFeeAmount: reminderFeeAmountNumber,
      });
    } catch (error) {
      console.error("Error creating reminder invoice:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Calculate penalty interest based on days overdue and original penalty interest rate
  const calculatePenaltyInterest = () => {
    if (!invoice.penaltyInterest) return 0;
    
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate penalty interest: (amount * rate * days) / (365 * 100)
    const penaltyAmount = (invoice.totalAmount * Number(invoice.penaltyInterest) * daysOverdue) / (365 * 100);
    return Math.round(penaltyAmount * 100) / 100; // Round to 2 decimals
  };

  const penaltyInterestAmount = calculatePenaltyInterest();
  const reminderFeeAmountNumber = includeReminderFee ? parseNordicNumber(reminderFeeAmount) : 0;
  const totalAdditionalAmount = (includePenaltyInterest ? penaltyInterestAmount : 0) + reminderFeeAmountNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Reminder Invoice</DialogTitle>
          <DialogDescription>
            Create a reminder invoice for invoice {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Invoice Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Original Invoice</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Invoice Number: {invoice.invoiceNumber}</div>
              <div>Amount: {formatCurrency(invoice.totalAmount)}</div>
              <div>Due Date: {new Date(invoice.dueDate).toLocaleDateString('fi-FI')}</div>
            </div>
          </div>

          <Separator />

          {/* Penalty Interest Option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="penalty-interest"
                checked={includePenaltyInterest}
                onCheckedChange={(checked) => setIncludePenaltyInterest(checked === true)}
              />
              <Label htmlFor="penalty-interest" className="text-sm font-medium">
                Include penalty interest
              </Label>
            </div>
            {includePenaltyInterest && (
              <div className="ml-6 text-sm text-muted-foreground">
                {invoice.penaltyInterest ? (
                  <>
                    <div>Rate: {formatNordicNumber(Number(invoice.penaltyInterest))}% per year</div>
                    <div>Days overdue: {Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))}</div>
                    <div className="font-medium">Amount: {formatCurrency(penaltyInterestAmount)}</div>
                  </>
                ) : (
                  <div className="text-amber-600">No penalty interest rate set on original invoice</div>
                )}
              </div>
            )}
          </div>

          {/* Reminder Fee Option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reminder-fee"
                checked={includeReminderFee}
                onCheckedChange={(checked) => setIncludeReminderFee(checked === true)}
              />
              <Label htmlFor="reminder-fee" className="text-sm font-medium">
                Include reminder fee
              </Label>
            </div>
            {includeReminderFee && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="reminder-amount" className="text-sm">
                  Reminder fee amount
                </Label>
                <Input
                  id="reminder-amount"
                  type="text"
                  value={reminderFeeAmount}
                  onChange={(e) => setReminderFeeAmount(e.target.value)}
                  placeholder="10,00"
                  className="w-32"
                />
              </div>
            )}
          </div>

          {/* Summary */}
          {totalAdditionalAmount > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Summary</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Original amount:</span>
                    <span>{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  {includePenaltyInterest && penaltyInterestAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Penalty interest:</span>
                      <span>{formatCurrency(penaltyInterestAmount)}</span>
                    </div>
                  )}
                  {includeReminderFee && reminderFeeAmountNumber > 0 && (
                    <div className="flex justify-between">
                      <span>Reminder fee:</span>
                      <span>{formatCurrency(reminderFeeAmountNumber)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total reminder amount:</span>
                    <span>{formatCurrency(invoice.totalAmount + totalAdditionalAmount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateReminder}
            disabled={isCreating || createReminderMutation.isPending}
          >
            {isCreating ? "Creating..." : "Create Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
