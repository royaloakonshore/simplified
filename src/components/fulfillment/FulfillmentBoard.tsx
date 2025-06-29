"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Order, OrderStatus, type Customer, type OrderItem, Prisma } from "@prisma/client"; // Import Prisma types
import { api } from "@/lib/trpc/react"; // Import tRPC hook
import { toast } from "sonner"; // Import sonner toast
import { Button } from "@/components/ui/button"; // Use Shadcn button
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Use Shadcn alert
import { Terminal } from 'lucide-react'; // Icons - Removed CheckCircle2, MoveRight

// Simplified Order type for props, assuming necessary includes are done by the caller
type BoardOrder = Order & {
    customer: Pick<Customer, 'id' | 'name'>;
    items: Pick<OrderItem, 'id'>[]; // Just need count
};

type FulfillmentBoardProps = {
  confirmedOrders: BoardOrder[];
  productionOrders: BoardOrder[];
};

export default function FulfillmentBoard({
  confirmedOrders,
  productionOrders,
}: FulfillmentBoardProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);

  // --- tRPC Mutation for Status Update ---
  // Note: Assumes an `updateStatus` procedure exists in the order router
  const updateStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: (data: Order) => {
      toast.success(`Order ${data.orderNumber} status updated to ${data.status}`); // Sonner toast
      setError(null);
      // Invalidate relevant queries to refresh data
      utils.order.list.invalidate(); // Or more specific query if available
      // Potentially invalidate queries used to fetch data for this board
      router.refresh(); // Simple way to refetch server component data
    },
    onError: (error) => {
      const message = error.data?.zodError?.formErrors.join(", ") || error.message;
      toast.error(message); // Sonner toast
      setError(message);
      console.error("Error updating order status:", error);
    },
  });

  // Format currency (assuming Decimal is handled)
  const formatCurrency = (amount: number | string | Prisma.Decimal) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(amount)); // Convert Decimal to number
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle order status update trigger
  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    setError(null); // Clear previous errors
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  // Function to render a single order card
  const renderOrderCard = (order: BoardOrder, nextStatus?: OrderStatus) => (
    <div
      key={order.id}
      className="bg-white dark:bg-neutral-800 rounded-md shadow-sm p-4 mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <Link
          href={`/orders/${order.id}`}
          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          {order.orderNumber}
        </Link>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatDate(order.updatedAt)}
        </span>
      </div>

      <div className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">
        {order.customer.name}
      </div>

      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {order.items.length} items · {formatCurrency(order.totalAmount ?? 0)}
      </div>

      {nextStatus && (
        <Button
          onClick={() => handleUpdateStatus(order.id, nextStatus)}
          disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.id === order.id}
          className="w-full"
          size="sm"
        >
          {updateStatusMutation.isPending && updateStatusMutation.variables?.id === order.id ? 'Updating...' :
           (nextStatus === OrderStatus.in_production ? 'Start Production' :
            nextStatus === OrderStatus.shipped ? 'Mark as Shipped' :
            nextStatus === OrderStatus.cancelled ? 'Cancel Order' : 'Update Status')
          }
        </Button>
      )}
    </div>
  );

  // Render board columns
  return (
    <div className="w-full">
      {error && (
        <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Update Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Confirmed Column */}
        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-md p-4">
          <h3 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white flex items-center">
            <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
            Confirmed (Ready for Production)
            <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
              ({confirmedOrders.length})
            </span>
          </h3>

          <div className="overflow-y-auto max-h-[70vh]">
            {confirmedOrders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center p-4">
                No orders waiting for production
              </p>
            ) : (
              confirmedOrders.map(order => renderOrderCard(order, OrderStatus.in_production))
            )}
          </div>
        </div>

        {/* In Production Column */}
        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-md p-4">
          <h3 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white flex items-center">
            <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
            In Production
            <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
              ({productionOrders.length})
            </span>
          </h3>

          <div className="overflow-y-auto max-h-[70vh]">
            {productionOrders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center p-4">
                No orders currently in production
              </p>
            ) : (
              productionOrders.map(order => renderOrderCard(order, OrderStatus.shipped))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 