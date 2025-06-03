'use client';

import React, { useState, useEffect } from 'react';
import { type Order, OrderStatus, Prisma } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { OrderType } from "@prisma/client";

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

  const { data: order, isLoading: isLoadingOrder, error: orderError, refetch } = api.order.getById.useQuery({ id: orderId as string }, { enabled: !!orderId });
  const updateStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: async (updatedOrder) => {
      toast.success(`Order ${updatedOrder.orderNumber} status updated to ${updatedOrder.status}`);
      await utils.order.list.invalidate(); // Invalidate list to reflect changes
      // also invalidate the specific order query if you have one for a detail page
      if (orderId) {
        await utils.order.getById.invalidate({ id: orderId }); 
      }
      if (onStatusUpdated) onStatusUpdated();
      onOpenChange(false); // Close modal on success
    },
    onError: (error) => {
      const trpcError = error as TRPCClientErrorLike<AppRouter>;
      toast.error(`Error updating status: ${trpcError.message}`);
    }
  });

  useEffect(() => {
    if (order && order.status !== selectedStatus) {
        setSelectedStatus(order.status);
    }
  }, [order, selectedStatus]);

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

  if (isLoadingOrder) return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Loading...</DialogTitle></DialogHeader><Skeleton className="h-20 w-full" /></DialogContent></Dialog>;
  if (orderError) return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Error</DialogTitle></DialogHeader><p>Error loading order details: {orderError.message}</p></DialogContent></Dialog>;
  if (!order) return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Not Found</DialogTitle></DialogHeader><p>Order not found.</p></DialogContent></Dialog>;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Update Status for Order ${order.orderNumber}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>Current status: <Badge variant={getStatusBadgeVariant(order.status)}>{order.status.replace("_", " ").toUpperCase()}</Badge></p>
          
          <div className="space-y-2">
              <Label htmlFor="orderStatus">New Status</Label>
              <Select onValueChange={(value) => setSelectedStatus(value as OrderStatus)} value={selectedStatus ?? order.status}>
                  <SelectTrigger id="orderStatus">
                      <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                      {Object.values(OrderStatus).map(status => (
                          <SelectItem key={status} value={status} disabled={status === order.status}>
                              {status.replace("_", " ").toUpperCase()}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
          
          {selectedStatus === OrderStatus.shipped && (
            <Alert>
              <AlertDescription>
                Updating to SHIPPED will make this order available for invoicing.
              </AlertDescription>
            </Alert>
          )}
           {selectedStatus === OrderStatus.in_production && order.orderType === OrderType.work_order && (
            <Alert variant="default">
              <AlertDescription>
                Starting production for a WORK_ORDER will attempt to deduct Bill of Materials components from stock.
              </AlertDescription>
            </Alert>
          )}

        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateStatusMutation.isPending}>Cancel</Button>
          <Button 
            onClick={handleStatusChangeSubmit} 
            disabled={updateStatusMutation.isPending || !selectedStatus || isLoadingOrder || !!orderError || selectedStatus === order.status}
          >
            {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Update'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 