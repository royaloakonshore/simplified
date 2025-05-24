'use client';

import React, { useState, useEffect } from 'react';
import { type Order, OrderStatus, Prisma } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface OrderStatusUpdateModalProps {
  orderId: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onStatusUpdated?: () => void; // Optional callback after status update
}

// Helper function to get order status badge variant (copied from OrderDetail)
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case OrderStatus.draft:
      return "secondary";
    case OrderStatus.confirmed:
    case OrderStatus.in_production:
      return "default";
    case OrderStatus.shipped:
    case OrderStatus.delivered:
    case OrderStatus.INVOICED: // Added INVOICED if it uses same styling
      return "outline";
    case OrderStatus.cancelled:
      return "destructive";
    default:
      return "secondary";
  }
};

export default function OrderStatusUpdateModal({ 
  orderId,
  isOpen,
  onOpenChange,
  onStatusUpdated
}: OrderStatusUpdateModalProps) {
  const utils = api.useUtils();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  const { data: order, isLoading: isLoadingOrder, error: orderError } = api.order.getById.useQuery(
    { id: orderId! }, 
    { enabled: !!orderId && isOpen } // Only fetch if orderId is present and modal is open
  );

  const updateStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: (updatedOrderData: Order) => {
      toast.success(`Order ${updatedOrderData.orderNumber} status updated to ${updatedOrderData.status}`);
      setMutationError(null);
      setSelectedStatus('');
      utils.order.getById.invalidate({ id: updatedOrderData.id });
      utils.order.list.invalidate(); // Invalidate list as well
      onOpenChange(false); // Close modal
      if (onStatusUpdated) onStatusUpdated();
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      const message = err.message ?? 'Failed to update order status.';
      setMutationError(message);
      toast.error(message);
    },
  });

  useEffect(() => {
    // Reset state when modal is closed or orderId changes
    if (!isOpen) {
      setSelectedStatus('');
      setMutationError(null);
    }
  }, [isOpen]);

  const getAvailableStatusTransitions = (currentStatus?: OrderStatus): OrderStatus[] => {
    if (!currentStatus) return [];
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled, OrderStatus.quote_sent],
      [OrderStatus.quote_sent]: [OrderStatus.quote_accepted, OrderStatus.quote_rejected, OrderStatus.cancelled],
      [OrderStatus.quote_accepted]: [OrderStatus.confirmed, OrderStatus.cancelled],
      [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled, OrderStatus.shipped ],
      [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
      [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.INVOICED, OrderStatus.cancelled], 
      [OrderStatus.delivered]: [OrderStatus.INVOICED, OrderStatus.cancelled],
      // INVOICED is a terminal state for this flow, no transitions from it via this modal
    };
    return validTransitions[currentStatus] ?? [];
  };

  const handleStatusChangeSubmit = () => {
    if (!orderId || !selectedStatus) {
      setMutationError('Order ID is missing or no status selected.');
      toast.error('Order ID is missing or no status selected.');
      return;
    }
    setMutationError(null);
    updateStatusMutation.mutate({ id: orderId, status: selectedStatus });
  };

  const availableTransitions = order ? getAvailableStatusTransitions(order.status) : [];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
        </DialogHeader>
        {isLoadingOrder && (
          <div className="py-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {orderError && (
          <Alert variant="destructive" className="my-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Order</AlertTitle>
            <AlertDescription>{orderError.message}</AlertDescription>
          </Alert>
        )}
        {!isLoadingOrder && !orderError && order && (
          <div className="py-4 space-y-4">
            {mutationError && (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Update Error</AlertTitle>
                <AlertDescription>{mutationError}</AlertDescription>
              </Alert>
            )}
            <div>Order: <span className="font-semibold">{order.orderNumber}</span></div>
            <div>Current Status: <Badge variant={getStatusBadgeVariant(order.status)}>{order.status.replace('_',' ').toUpperCase()}</Badge></div>
            {availableTransitions.length > 0 ? (
              <Select onValueChange={(value) => setSelectedStatus(value as OrderStatus)} value={selectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  {availableTransitions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_',' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">No further status transitions available for this order.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={updateStatusMutation.isPending}>Cancel</Button>
          </DialogClose>
          {order && availableTransitions.length > 0 && (
            <Button
              onClick={handleStatusChangeSubmit}
              disabled={updateStatusMutation.isPending || !selectedStatus || isLoadingOrder || !!orderError}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Update'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 