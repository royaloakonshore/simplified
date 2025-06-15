"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderType, OrderStatus } from '@prisma/client';
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
import { CheckCircle, Send, FileText, Factory } from 'lucide-react';

interface OrderSubmissionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderType: OrderType;
  orderNumber: string;
}

export default function OrderSubmissionModal({
  isOpen,
  onOpenChange,
  orderId,
  orderType,
  orderNumber,
}: OrderSubmissionModalProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated successfully!");
      onOpenChange(false);
      router.push(`/orders/${orderId}`);
    },
    onError: (err) => {
      toast.error(`Failed to update status: ${err.message}`);
      setIsUpdating(false);
    },
  });

  const handleStatusUpdate = (newStatus: OrderStatus) => {
    setIsUpdating(true);
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus,
    });
  };

  const handleKeepDraft = () => {
    onOpenChange(false);
    router.push(`/orders/${orderId}`);
  };

  const isQuotation = orderType === OrderType.quotation;
  const isWorkOrder = orderType === OrderType.work_order;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <DialogTitle>
              {isQuotation ? "Quotation Saved" : "Work Order Saved"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {orderNumber} has been saved successfully. What would you like to do next?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isQuotation && (
            <>
              <Button
                onClick={() => handleStatusUpdate(OrderStatus.confirmed)}
                disabled={isUpdating}
                className="w-full"
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
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
            </>
          )}

          {isWorkOrder && (
            <>
              <Button
                onClick={() => handleStatusUpdate(OrderStatus.confirmed)}
                disabled={isUpdating}
                className="w-full"
              >
                <Factory className="mr-2 h-4 w-4" />
                Confirm and Send to Production
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 