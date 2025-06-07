'use client';

import React, { useState, useEffect } from 'react';
import { OrderStatus } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  const { data: order, isLoading: isLoadingOrder, error: orderError } = api.order.getById.useQuery({ id: orderId as string }, { enabled: !!orderId });
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

  const handleStatusChangeSubmit = () => {
    if (!orderId || !selectedStatus) {
      toast.error('Order ID is missing or no status selected.');
      return;
    }
    updateStatusMutation.mutate({ id: orderId, status: selectedStatus });
  };

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