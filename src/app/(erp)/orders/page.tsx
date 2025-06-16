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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner"; // Import sonner toast
import { useQueryClient } from '@tanstack/react-query'; // Correct import for react-query
import React from 'react';
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'delete' | 'sendToProduction' | null>(null);

  // Extract pagination/filter parameters from URL
  const limit = Number(searchParams.get('limit') ?? 10);
  const status = searchParams.get('status') as OrderStatus | undefined;
  const customerId = searchParams.get('customerId') ?? undefined;

  const queryClient = useQueryClient();

  const { data, error, isLoading, isFetching } = api.order.list.useQuery({
    limit,
    cursor,
    status,
    customerId,
  });

  const orders: OrderInTable[] = (data?.items as OrderInTable[]) ?? [];
  const nextCursor = data?.nextCursor;

  useEffect(() => {
    // Clear selection when data reloads (e.g., pagination)
    setSelectedOrderIds([]);
  }, [data]);

  // Selection management functions
  const handleSelectOrder = (orderId: string, isSelected: boolean) => {
    setSelectedOrderIds(prev => 
      isSelected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedOrderIds(isSelected ? orders.map(order => order.id) : []);
  };

  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  // Bulk actions
  const handleBulkExportPDF = () => {
    if (selectedOrderIds.length === 0) {
      toast("Please select orders first.");
      return;
    }
    // TODO: Implement bulk PDF export
    toast.success(`Exporting PDF for ${selectedOrderIds.length} orders - Implementation pending`);
  };

  // TODO: Create these tRPC mutations in order.router.ts
  const deleteOrdersMutation = api.order.deleteMany.useMutation({
    onSuccess: () => {
      toast.success("Selected orders deleted.");
      queryClient.invalidateQueries({ queryKey: [["order", "list"]] });
      setSelectedOrderIds([]);
    },
    onError: (err) => {
      toast.error(`Failed to delete orders: ${err.message}`);
    },
    onSettled: () => {
      setShowConfirmationDialog(false);
    }
  });

  const sendToProductionMutation = api.order.sendManyToProduction.useMutation({
    onSuccess: (result) => {
      const failCount = selectedOrderIds.length - result.count;
      toast.success(`Processing complete. ${result.count} orders sent to production, ${failCount} failed/skipped.`);
      queryClient.invalidateQueries({ queryKey: [["order", "list"]] });
      setSelectedOrderIds([]);
    },
    onError: (err) => {
      toast.error(`Failed to send orders to production: ${err.message}`);
    },
    onSettled: () => {
      setShowConfirmationDialog(false);
    }
  });

  const openConfirmationModal = (action: 'delete' | 'sendToProduction') => {
    if (selectedOrderIds.length === 0) {
      toast("Please select orders first.");
      return;
    }
    // TODO: For 'sendToProduction', could pre-filter here based on order status if data is available client-side
    // to provide a more accurate count in the confirmation, or let the backend handle filtering.
    setConfirmationAction(action);
    setShowConfirmationDialog(true);
  };

  const handleConfirmAction = async () => {
    if (confirmationAction === 'delete') {
      deleteOrdersMutation.mutate({ ids: selectedOrderIds });
    } else if (confirmationAction === 'sendToProduction') {
      sendToProductionMutation.mutate({ ids: selectedOrderIds });
    }
  };

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

      {/* Enhanced OrderTable */}
      <div className="mt-6">
        {isLoading || isFetching ? (
            <TableLoadingSkeleton />
        ) : (
            <OrderTable 
              orders={orders}
              nextCursor={nextCursor}
              selectedOrderIds={selectedOrderIds}
              onSelectOrder={handleSelectOrder}
              onSelectAll={handleSelectAll}
              isAllSelected={isAllSelected}
              onBulkExportPDF={handleBulkExportPDF}
              showBulkActions={true}
            />
        )}
      </div>



      <AlertDialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationAction === 'delete' ? "Confirm Deletion" : "Confirm Send to Production"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationAction === 'delete'
                ? `Are you sure you want to delete ${selectedOrderIds.length} order(s)? This action cannot be undone.`
                : `Are you sure you want to send ${selectedOrderIds.length} order(s) to production?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrdersMutation.isPending || sendToProductionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={deleteOrdersMutation.isPending || sendToProductionMutation.isPending}>
              {(deleteOrdersMutation.isPending || sendToProductionMutation.isPending) ? "Processing..." : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderListContent />
      </Suspense>
    </div>
  );
} 