'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { api } from "@/lib/trpc/react";
import { InventoryTable } from '@/components/inventory/InventoryTable'; // Corrected path
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // For skeleton states
import React from 'react';

// Skeleton for the inventory table (can be more detailed if needed)
function InventoryPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" /> {/* Title skeleton */}
        <Skeleton className="h-10 w-32" /> {/* Button skeleton */}
      </div>
      <Skeleton className="h-64 w-full" /> {/* Table content skeleton */}
    </div>
  );
}

// Component to handle fetching and displaying inventory data
function InventoryListContent() {
  // For simplicity, fetching all items initially. 
  // TODO: Implement pagination and filtering based on router capabilities
  const { data, error, isLoading } = api.inventory.list.useQuery({
    // limit: 10, // Example: Add limit/cursor later if needed
  });

  if (error) {
    return <div className="text-red-600">Error loading inventory: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Items</h1>
        <Button asChild>
          <Link href="/inventory/add">Create New Item</Link>
        </Button>
      </div>
      {/* Pass isLoading to InventoryTable to handle its own skeleton/loading message */}
      <InventoryTable items={data?.items ?? []} isLoading={isLoading && !data} /> 
    </div>
  );
}

// Main page component
export default function InventoryPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
       <Suspense fallback={<InventoryPageSkeleton />}>
         <InventoryListContent />
       </Suspense>
    </div>
  );
} 