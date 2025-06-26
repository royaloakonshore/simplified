'use client'; // Make this a client component to use tRPC hooks

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; // Hook for accessing search params
import { Prisma } from '@prisma/client'; // Import Prisma namespace for Decimal

import { api } from "@/lib/trpc/react"; // Import tRPC client hook
// import { OrderFilter } from '@/components/orders/OrderFilter'; // Keep commented
import { OrderStatus, Customer, Order } from "@prisma/client"; // Import directly from prisma
import OrderTable from "@/components/orders/OrderTable"; // Import the enhanced OrderTable
import { Button } from "@/components/ui/button"; // Use Shadcn button
import { Skeleton } from "@/components/ui/skeleton"; // Use Shadcn skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Use Shadcn alert
import { Terminal } from 'lucide-react'; // Icon for alert
import React from 'react';
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import SalesFunnel from "@/components/orders/SalesFunnel";

// Type definition for order data
type OrderInTable = Order & {
  customer: Pick<Customer, 'id' | 'name'> | null;
};

// New component to handle search params and data fetching + rendering
function OrderListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams(); 
  const cursor = searchParams.get('cursor');

  // Extract pagination/filter parameters from URL
  const limit = Number(searchParams.get('limit') ?? 10);
  const status = searchParams.get('status') as OrderStatus | undefined;
  const customerId = searchParams.get('customerId') ?? undefined;



  const { data, error, isLoading, isFetching } = api.order.list.useQuery({
    limit,
    cursor,
    status,
    customerId,
  });

  const orders: OrderInTable[] = (data?.items as OrderInTable[]) ?? [];
  const nextCursor = data?.nextCursor;

  // The table state management is now handled by the OrderTable component using TanStack Table

  const handleNextPage = () => {
    if (nextCursor) {
      const params = new URLSearchParams(searchParams);
      params.set('cursor', nextCursor);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const TableLoadingSkeleton = () => (
    <div className="space-y-4">
        <div className="border rounded-md">
            <Skeleton className="h-12 w-full" /> {/* Table header */}
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
            <Skeleton className="h-9 w-24" /> {/* Pagination button */}
        </div>
    </div>
  );

  if (error) {
    return (
      <Alert variant="destructive" className="mt-6">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Orders</AlertTitle>
        <AlertDescription>{error.message || 'An unknown error occurred.'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* <Suspense fallback={<div>Loading filters...</div>}> */}
      {/*   <OrderFilter /> */}
      {/* </Suspense> */}

      {/* Advanced OrderTable */}
      <div className="mt-6">
        {isLoading || isFetching ? (
            <TableLoadingSkeleton />
        ) : (
            <OrderTable 
              data={orders}
              isLoading={isLoading}
              onDataChange={(updatedData) => {
                // Handle data changes if needed
                console.log('Orders table data changed:', updatedData);
              }}
            />
        )}
      </div>




    </>
  );
}

// Main page component
export default function OrdersPage() {
  return (
    <div className="w-full">
      <PageBanner>
        <BannerTitle>Orders</BannerTitle>
      </PageBanner>

      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button asChild>
          <Link href="/orders/add">Create New Order</Link>
        </Button>
      </div>

      {/* Sales Funnel Visualization */}
      <div className="mb-6">
        <SalesFunnel />
      </div>

      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderListContent />
      </Suspense>
    </div>
  );
} 