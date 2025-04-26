'use client'; // Need client component for hooks

import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Use hooks
import { api } from "@/lib/trpc/react"; // Import tRPC hooks
import OrderForm from '@/components/orders/OrderForm';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Removed unused imports: prisma, MaterialType

export default function AddOrderPage() {
  const router = useRouter();

  // Fetch customers for dropdown
  const { data: customerData, error: customerError, isLoading: isLoadingCustomers } = api.customer.list.useQuery({});

  // Fetch inventory items for dropdown
  const { data: inventoryData, error: inventoryError, isLoading: isLoadingInventory } = api.inventory.list.useQuery({ limit: 1000 });

  const isLoading = isLoadingCustomers || isLoadingInventory;
  const error = customerError || inventoryError;

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
             {error.message || 'An unknown error occurred while loading data for the form.'}
             <div className="mt-4">
                <Button onClick={() => router.back()} variant="secondary">Go Back</Button>
             </div>
           </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Data fetched successfully
  const customers = customerData?.items ?? [];
  const inventoryItems = inventoryData?.items ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
         <Button variant="outline" size="sm" asChild className="mr-4">
            <Link href="/orders">← Back to Orders</Link>
         </Button>
        <h1 className="text-2xl font-bold">
          Create New Order
        </h1>
      </div>

      {/* Pass fetched data directly - OrderForm placeholder expects Prisma types */}
      <OrderForm customers={customers} inventoryItems={inventoryItems} />
    </div>
  );
} 