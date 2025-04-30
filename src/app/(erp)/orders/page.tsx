'use client'; // Make this a client component to use tRPC hooks

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // Hook for accessing search params

import { api } from "@/lib/trpc/react"; // Import tRPC client hook
import OrderTable from '@/components/orders/OrderTable'; // UNCOMMENTED
// import { OrderFilter } from '@/components/orders/OrderFilter'; // Keep commented
// import OrderFilter from '@/components/orders/OrderFilter'; // Assuming this component exists - COMMENTED OUT FOR NOW
import { OrderStatus } from "@prisma/client"; // Import directly from prisma
import { Button } from "@/components/ui/button"; // Use Shadcn button
import { Skeleton } from "@/components/ui/skeleton"; // Use Shadcn skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Use Shadcn alert
import { Terminal } from 'lucide-react'; // Icon for alert

// NOTE: Removed complex mapping and branded types. Components should handle Prisma types.
// Removed unused imports: MaterialType, FormOrder, FormOrderItem, FormInventoryItem, FormAddress, AddressType, UUID, Decimal, createUUID, createDecimal

// New component to handle search params and data fetching
function OrderListContent() {
  const searchParams = useSearchParams(); // Use hook to get search params

  // Extract pagination/filter parameters from URL
  // tRPC uses cursor-based pagination
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit = Number(searchParams.get('limit') ?? 10);
  const status = searchParams.get('status') as OrderStatus | undefined;
  const customerId = searchParams.get('customerId') ?? undefined;
  // Add other filters as needed based on listOrdersSchema

  // Fetch orders using the tRPC hook
  const { data, error, isLoading, isFetching } = api.order.list.useQuery({
    limit,
    cursor,
    status,
    customerId,
    // Pass other filters here
  });

  // Handle loading state
  const TableLoadingSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
    </div>
  );

  // Handle error state
  if (error) {
    return (
      <div className="p-6">
         <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error Loading Orders</AlertTitle>
            <AlertDescription>
              {error.message || 'An unknown error occurred.'}
            </AlertDescription>
         </Alert>
      </div>
    );
  }

  // Extract data safely
  const orders = data?.items ?? [];
  const nextCursor = data?.nextCursor;

  // TODO: Uncomment and adapt OrderFilter to handle:
  // 1. Prisma types directly (especially Decimal values from tRPC response)
  // 2. Cursor-based pagination (using nextCursor to fetch next page)
  // 3. isLoading/isFetching state for displaying skeletons

  return (
    <>
        {/* <Suspense fallback={<div>Loading filters...</div>}> */}
        {/*   <OrderFilter /> */}
        {/* </Suspense> */}

        <div className="mt-6">
            {isLoading || isFetching ? (
                <TableLoadingSkeleton />
            ) : (
                <OrderTable
                    orders={orders}
                    nextCursor={nextCursor}
                />
            )}
        </div>
    </>
  );
}

// Define props if needed, but search params are handled by the hook now
// type OrdersPageProps = { ... };

// Main page component
export default function OrdersPage() {
  // REMOVED: Logic that used useSearchParams directly

  // NOTE: Removed complex mapping and branded types. Components should handle Prisma types.
  // Removed unused imports: MaterialType, FormOrder, FormOrderItem, FormInventoryItem, FormAddress, AddressType, UUID, Decimal, createUUID, createDecimal

  // Render the main page structure and wrap OrderListContent in Suspense
  return (
    // Add container class like Invoices page
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Button asChild>
            <Link href="/orders/add">Create New Order</Link>
        </Button>
      </div>

      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderListContent />
      </Suspense>
    </div>
  );
} 