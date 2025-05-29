'use client'; // Make this a client component to use tRPC hooks

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; // Hook for accessing search params
import { Prisma } from '@prisma/client'; // Import Prisma namespace for Decimal

import { api } from "@/lib/trpc/react"; // Import tRPC client hook
// import { OrderFilter } from '@/components/orders/OrderFilter'; // Keep commented
import { OrderStatus, Customer, Order } from "@prisma/client"; // Import directly from prisma
import { Button } from "@/components/ui/button"; // Use Shadcn button
import { Skeleton } from "@/components/ui/skeleton"; // Use Shadcn skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Use Shadcn alert
import { Terminal, ArrowRight, ArrowLeft } from 'lucide-react'; // Icon for alert + Pagination
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"; // Import Table components
import { Badge } from "@/components/ui/badge"; // Import Badge
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChevronDown, Trash2, Send } from 'lucide-react'; // Icons for actions
import { toast } from 'react-toastify';

// Moved type definition from OrderTable
type OrderInTable = Order & {
  customer: Pick<Customer, 'id' | 'name'> | null;
};

// Moved helper functions from OrderTable
const formatCurrency = (amount: number | string | Prisma.Decimal) => {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
};
const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('fi-FI', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
};
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
    // ... (status badge logic)
    switch (status) {
      case OrderStatus.draft:
        return "secondary";
      case OrderStatus.confirmed:
      case OrderStatus.in_production:
        return "default";
      case OrderStatus.shipped:
      case OrderStatus.delivered:
        return "outline";
      case OrderStatus.cancelled:
        return "destructive";
      default:
        return "secondary";
    }
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
  const [actionInProgress, setActionInProgress] = useState(false);

  // Extract pagination/filter parameters from URL
  const limit = Number(searchParams.get('limit') ?? 10);
  const status = searchParams.get('status') as OrderStatus | undefined;
  const customerId = searchParams.get('customerId') ?? undefined;

  const utils = api.useUtils();

  const { data, error, isLoading, isFetching, refetch } = api.order.list.useQuery({
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

  const handleSelectOrder = (orderId: string, isSelected: boolean) => {
    setSelectedOrderIds(prev => 
      isSelected ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected && data?.items) {
      setSelectedOrderIds(data.items.map(order => order.id));
    } else {
      setSelectedOrderIds([]);
    }
  };
  
  const isAllSelected = data?.items && data.items.length > 0 && selectedOrderIds.length === data.items.length;

  // TODO: Create these tRPC mutations in order.router.ts
  const deleteOrdersMutation = api.order.deleteMany.useMutation({
    onSuccess: () => {
      toast.success("Selected orders deleted.");
      refetch();
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
      // result could contain info about successes/failures
      toast.success(`Processing complete. ${result.successCount} orders sent to production, ${result.failCount} failed/skipped.`);
      refetch();
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
      toast.warn("Please select orders first.");
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

      {/* Table Rendering directly here */}
      <div className="mt-6">
        {isLoading || isFetching ? (
            <TableLoadingSkeleton />
        ) : (
            <div> { /* Added wrapper div for table + pagination */}
                <div className="border rounded-md">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                            No orders found.
                            </TableCell>
                        </TableRow>
                        ) : (
                        orders.map((order) => (
                            <TableRow key={order.id}>
                            <TableCell className="font-medium">
                                <Link href={`/orders/${order.id}`} className="hover:underline">
                                {order.orderNumber}
                                </Link>
                            </TableCell>
                            <TableCell>{order.customer?.name ?? '-'}</TableCell>
                            <TableCell>{formatDate(order.createdAt)}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusBadgeVariant(order.status)}>
                                    {order.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(order.totalAmount ?? 0)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm" asChild>
                                <Link href={`/orders/${order.id}`}>View</Link>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                    </Table>
                </div>
                {/* Pagination Controls */}
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNextPage()}
                    disabled={!nextCursor}
                    >
                    Next Page <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Bulk Actions</h2>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={selectedOrderIds.length === 0 || deleteOrdersMutation.isPending || sendToProductionMutation.isPending}>
                  Actions <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  disabled={selectedOrderIds.length === 0 || deleteOrdersMutation.isPending}
                  onClick={() => openConfirmationModal('delete')}
                >
                  {deleteOrdersMutation.isPending ? "Deleting..." : "Delete Selected"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  disabled={selectedOrderIds.length === 0 || sendToProductionMutation.isPending}
                  onClick={() => openConfirmationModal('sendToProduction')}
                >
                  {sendToProductionMutation.isPending ? "Sending..." : "Send to Production"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link href="/orders/add">Create New Order</Link>
            </Button>
          </div>
        </div>
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