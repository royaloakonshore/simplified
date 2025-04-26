'use client'; // Need client component for hooks

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation'; // Use hooks
import { api } from "@/lib/trpc/react"; // Import tRPC hooks
import OrderForm from '@/components/orders/OrderForm';
import { OrderStatus } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Removed unused imports: notFound, prisma, getOrderById, MaterialType, FormOrder, FormOrderItem, FormInventoryItem, FormAddress, AddressType, UUID, Decimal, createUUID, createDecimal

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  // Fetch order data
  const { data: orderData, error: orderError, isLoading: isLoadingOrder } = api.order.getById.useQuery(
    { id: orderId },
    { enabled: !!orderId } // Only run query if orderId is available
  );

  // Fetch customers for dropdown
  // TODO: Adjust input if filtering/pagination needed, or fetch all?
  const { data: customerData, error: customerError, isLoading: isLoadingCustomers } = api.customer.list.useQuery({});

  // Fetch inventory items for dropdown
  // TODO: Adjust input if filtering/pagination needed, or fetch all?
  // Fetching with a large limit to approximate getting all items for selection
  const { data: inventoryData, error: inventoryError, isLoading: isLoadingInventory } = api.inventory.list.useQuery({ limit: 1000 });

  const isLoading = isLoadingOrder || isLoadingCustomers || isLoadingInventory;
  const error = orderError || customerError || inventoryError;

  if (isLoading) {
    return (
        <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Error Loading Data</AlertTitle>
           <AlertDescription>
             {error.message || 'An unknown error occurred while loading data for the order form.'}
             <div className="mt-4">
                <Button onClick={() => router.back()} variant="secondary">Go Back</Button>
             </div>
           </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Data fetched successfully
  const order = orderData;
  const customers = customerData?.items ?? [];
  const inventoryItems = inventoryData?.items ?? [];

  if (!order) {
    // Handle case where order specifically wasn't found (but other data might have loaded)
     return (
      <div className="p-6">
        <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Order Not Found</AlertTitle>
           <AlertDescription>
             The requested order could not be found.
             <div className="mt-4">
                <Button asChild variant="secondary">
                    <Link href="/orders">Return to Orders</Link>
                </Button>
             </div>
           </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check if order status allows editing
  if (order.status !== OrderStatus.draft) {
    return (
      <div className="p-6">
        <Alert variant="default">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Cannot Edit Order</AlertTitle>
          <AlertDescription>
            Only orders in "Draft" status can be edited. This order is currently "{order.status}".
             <div className="mt-4">
                 <Button asChild variant="secondary">
                    <Link href={`/orders/${orderId}`}>View Order</Link>
                 </Button>
             </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" asChild className="mr-4">
             <Link href={`/orders/${orderId}`}>← Back to Order</Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Edit Order {order.orderNumber}
        </h1>
      </div>

      {/* Pass fetched data directly - OrderForm needs to handle Prisma types */}
      <OrderForm
        customers={customers}
        inventoryItems={inventoryItems}
        order={order}
        isEditMode={true}
      />
    </div>
  );
} 