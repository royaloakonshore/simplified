"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Order, OrderStatus, OrderType, type Customer, type OrderItem, type InventoryItem, type Address, Prisma } from "@prisma/client"; // Import Prisma types
import { api } from "@/lib/trpc/react"; // Import tRPC hook
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"; // Use Shadcn badge
import ClientOnly from "@/components/ClientOnly"; // Import ClientOnly

// Define the expected shape of the order prop with includes
type OrderDetailProps = {
  order: Order & {
    customer: Customer & {
      addresses?: Address[] | null; // Make addresses optional
    };
    items: (OrderItem & {
      inventoryItem: InventoryItem; // Changed from 'item' to 'inventoryItem'
    })[];
    // Add stock status info if needed, fetched separately or included
    // stockStatus?: { itemId: string; hasSufficientStock: boolean; }[];
  };
};

// Helper function to get order type display text
const getOrderTypeDisplay = (orderType: OrderType): string => {
  switch (orderType) {
    case OrderType.work_order:
      return "Work Order";
    case OrderType.quotation:
      return "Quotation";
    default:
      return orderType;
  }
};

export default function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  // --- tRPC Mutation for Status Update ---
  const updateStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: (data: Order) => {
      toast.success(`Order ${data.orderNumber} status updated to ${data.status}`);
      setError(null);
      setShowStatusModal(false); // Close modal on success
      setSelectedStatus('');
      // Invalidate this specific order query and potentially list queries
      utils.order.getById.invalidate({ id: data.id });
      utils.order.list.invalidate();
      router.refresh(); // Or rely on query invalidation to update UI
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      const message = err.message ?? 'Failed to update order status.';
      setError(message);
      toast.error(message);
      // Keep modal open on error?
      // setShowStatusModal(false);
    },
  });

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Format currency
  const formatCurrency = (amount: number | string | Prisma.Decimal) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency', currency: 'EUR',
    }).format(Number(amount));
  };

  // Get available status transitions
  const getAvailableStatusTransitions = (): OrderStatus[] => {
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled],
      [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled],
      [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
      [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.cancelled],
    };
    return validTransitions[order.status] ?? [];
  };

  // Handle status change submission from modal
  const handleStatusChangeSubmit = () => {
    if (!selectedStatus) {
      setError('Please select a status.'); // Show error inside modal
      toast.error('Please select a status.');
      return;
    }
    setError(null);
    updateStatusMutation.mutate({ id: order.id, status: selectedStatus });
  };

  // Status badge variant mapping
  const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case OrderStatus.draft:
        return "secondary";
      case OrderStatus.confirmed:
      case OrderStatus.in_production:
        return "default"; // Blue default
      case OrderStatus.shipped:
      case OrderStatus.delivered:
        return "outline"; // Use outline for success-like states maybe?
      case OrderStatus.cancelled:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const availableStatusTransitions = getAvailableStatusTransitions();

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md shadow overflow-hidden">
      {/* Order Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-semibold">Order {order.orderNumber}</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {getOrderTypeDisplay(order.orderType)}
            </Badge>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {order.status === OrderStatus.draft && (
              <Button asChild size="sm">
                 <Link href={`/orders/${order.id}/edit`}>Edit Order</Link>
              </Button>
            )}
            {availableStatusTransitions.length > 0 && (
              <ClientOnly> {/* Wrap the entire Dialog instance */} 
                <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
                  <DialogTrigger asChild>
                    <Button size="sm">Update Status</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Order Status</DialogTitle>
                    </DialogHeader>
                    {/* Content that was previously wrapped in ClientOnly is now part of this larger ClientOnly block */}
                    <div className="py-4 space-y-4">
                      {error && (
                        <Alert variant="destructive">
                          <Terminal className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <div>Current Status: <Badge variant={getStatusBadgeVariant(order.status)}>{order.status.replace('_',' ').toUpperCase()}</Badge></div>
                      <Select onValueChange={(value) => setSelectedStatus(value as OrderStatus)} value={selectedStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStatusTransitions.map(status => (
                            <SelectItem key={status} value={status}>
                              {status.replace('_',' ').toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" disabled={updateStatusMutation.isPending}>Cancel</Button>
                      </DialogClose>
                      <Button
                        onClick={handleStatusChangeSubmit}
                        disabled={updateStatusMutation.isPending || !selectedStatus}
                      >
                        {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Update'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </ClientOnly> /* End wrap for Dialog instance */
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>Created on {formatDate(order.createdAt)}</p>
          <p>Last updated on {formatDate(order.updatedAt)}</p>
        </div>
      </div>

      {/* Order Details Grid */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Column */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium mb-2">Customer</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-primary"><Link href={`/customers/${order.customer.id}`} className="hover:underline">{order.customer.name}</Link></p>
            {order.customer.email && <p>{order.customer.email}</p>}
            {order.customer.phone && <p>{order.customer.phone}</p>}
            {order.customer.vatId && <p>VAT ID: {order.customer.vatId}</p>}
            {order.customer.addresses && order.customer.addresses.length > 0 && (
              <div className="pt-2 mt-2 border-t">
                 <p className="font-medium text-primary">
                  {order.customer.addresses[0].type.charAt(0).toUpperCase() + order.customer.addresses[0].type.slice(1)} Address:
                </p>
                <p>{order.customer.addresses[0].streetAddress}</p>
                <p>{order.customer.addresses[0].postalCode} {order.customer.addresses[0].city}</p>
                <p>{order.customer.addresses[0].countryCode}</p>
              </div>
            )}
             {/* Display other address if exists */} 
             {order.customer.addresses && order.customer.addresses.length > 1 && (
              <div className="pt-2 mt-2 border-t">
                 <p className="font-medium text-primary">
                  {order.customer.addresses[1].type.charAt(0).toUpperCase() + order.customer.addresses[1].type.slice(1)} Address:
                </p>
                <p>{order.customer.addresses[1].streetAddress}</p>
                <p>{order.customer.addresses[1].postalCode} {order.customer.addresses[1].city}</p>
                <p>{order.customer.addresses[1].countryCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Column */}
        <div className="md:col-span-2">
            <h3 className="text-lg font-medium mb-2">Order Items</h3>
            <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Qty</th>
                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                            <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Line Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                        {order.items.map(orderItem => (
                            <tr key={orderItem.id}>
                                <td className="px-4 py-2 text-sm">
                                    <Link href={`/inventory/${orderItem.inventoryItem.id}`} className="font-medium text-primary hover:underline">
                                      {orderItem.inventoryItem.name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground">SKU: {orderItem.inventoryItem.sku}</div>
                                </td>
                                <td className="px-4 py-2 text-right text-sm">{orderItem.quantity.toString()}</td>
                                <td className="px-4 py-2 text-right text-sm">{formatCurrency(orderItem.unitPrice)}</td>
                                <td className="px-4 py-2 text-right text-sm">
                                    {formatCurrency(new Prisma.Decimal(orderItem.quantity).mul(orderItem.unitPrice))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                     <tfoot className="bg-muted/50 border-t">
                        <tr>
                            <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium uppercase">Total</td>
                            <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(order.totalAmount ?? 0)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
             {order.notes && (
                 <div className="mt-4">
                    <h4 className="font-medium mb-1">Notes:</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
} 