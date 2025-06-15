"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceStatus } from '@prisma/client';
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Send, FileText, Download } from 'lucide-react';

interface InvoiceSubmissionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
}

export default function InvoiceSubmissionModal({
  isOpen,
  onOpenChange,
  invoiceId,
  invoiceNumber,
}: InvoiceSubmissionModalProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatusMutation = api.invoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status updated successfully!");
      onOpenChange(false);
      router.push(`/invoices/${invoiceId}`);
    },
    onError: (err: any) => {
      toast.error(`Failed to update status: ${err.message}`);
      setIsUpdating(false);
    },
  });

  const handleStatusUpdate = (newStatus: InvoiceStatus) => {
    setIsUpdating(true);
    updateStatusMutation.mutate({
      id: invoiceId,
      status: newStatus,
    });
  };

  const handleKeepDraft = () => {
    onOpenChange(false);
    router.push(`/invoices/${invoiceId}`);
  };

  const handleExportFinvoice = () => {
    // TODO: Implement Finvoice export
    toast.info("Finvoice export functionality coming soon");
    onOpenChange(false);
    router.push(`/invoices/${invoiceId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <DialogTitle>Invoice Created</DialogTitle>
          </div>
          <DialogDescription>
            {invoiceNumber} has been created successfully. What would you like to do next?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => handleStatusUpdate(InvoiceStatus.sent)}
            disabled={isUpdating}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            Mark as Sent
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleExportFinvoice}
            disabled={isUpdating}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Finvoice XML
          </Button>
          
          <Button
            variant="outline"
            onClick={handleKeepDraft}
            disabled={isUpdating}
            className="w-full"
          >
            <FileText className="mr-2 h-4 w-4" />
            Keep as Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 