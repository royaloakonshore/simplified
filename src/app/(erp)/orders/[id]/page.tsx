'use client'; // Need client component for hooks

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation'; // Use hooks
import { api } from "@/lib/trpc/react"; // Import tRPC hooks
import OrderDetail from '@/components/orders/OrderDetail';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Removed unused imports: notFound, getOrderById, OrderStatus, MaterialType, FormOrder, FormOrderItem, OrderWithStockStatus, FormInventoryItem, FormAddress, AddressType, UUID, Decimal, createUUID, createDecimal

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  // Fetch order data using tRPC hook
  const { data: order, error, isLoading } = api.order.getById.useQuery(
    { id: orderId },
    {
      enabled: !!orderId, // Only run query if orderId is available
      // Optional: Refetch configuration
      // refetchOnWindowFocus: false,
    }
  );

  if (isLoading) {
    return (
        <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/4 mb-6" /> {/* Back link area */}
            <Skeleton className="h-24 w-full" /> {/* Header area */}
            <Skeleton className="h-96 w-full" /> {/* Detail area */}
        </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Error Loading Order</AlertTitle>
           <AlertDescription>
             {error?.message || 'The requested order could not be found or loaded.'}
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

  // Data fetched successfully
  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
         <Button variant="outline" size="sm" asChild className="mr-4">
            <Link href="/orders">← Back to Orders</Link>
         </Button>
         {/* Maybe add title here if OrderDetail doesn't include it */}
         {/* <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1> */}
      </div>

      {/* Pass fetched Prisma data directly - OrderDetail needs to handle it */}
      {/* Ensure the type passed matches what OrderDetail expects */}
      <OrderDetail order={order} />
    </div>
  );
} 