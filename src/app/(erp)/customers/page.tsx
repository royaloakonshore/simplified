'use client';

import { Suspense } from 'react';
import Link from 'next/link';
// import { useSearchParams, useRouter } from 'next/navigation'; // No longer needed for client-side table
// import { usePathname } from 'next/navigation'; // No longer needed for client-side table
import { api } from "@/lib/trpc/react";
import CustomerTable from '@/components/customers/CustomerTable';
import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input"; // Search input now in DataTableToolbar
// import { debounce } from 'lodash'; // No longer needed here
import React from 'react';
import { CustomerTableSkeleton } from "@/components/customers/CustomerTableSkeleton"; // Import the skeleton

// Component to handle fetching and displaying data
function CustomerListContent() {
  // const router = useRouter();
  // const pathname = usePathname();
  // const searchParams = useSearchParams();

  // // Get pagination and filter state from URL - No longer managing here for client-side table
  // const page = Number(searchParams.get('page') ?? 1);
  // const perPage = Number(searchParams.get('perPage') ?? 10);
  // const search = searchParams.get('search') ?? undefined;
  // const sortBy = (searchParams.get('sortBy') as 'name' | 'email' | 'createdAt') ?? 'name';
  // const sortDirection = (searchParams.get('sortDirection') as 'asc' | 'desc') ?? 'asc';

  // Fetch data using tRPC - simplified for client-side table
  const { data, error, isLoading } = api.customer.list.useQuery({
    // No params needed for now, fetching all for client-side table
  });

  // // Debounced search handler - Handled by DataTableToolbar now
  // const debouncedSearch = React.useCallback(...);
  // const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { ... };

  if (error) {
    return <div className="text-red-600">Error loading customers: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Search input is now part of DataTableToolbar inside CustomerTable */}
        <div> {/* Placeholder for alignment if needed, or remove outer div if only button */} </div>
         <Button asChild>
           <Link href="/customers/add">Create New Customer</Link>
         </Button>
      </div>
      {isLoading && !data ? (
        <CustomerTableSkeleton /> // Use the skeleton component
      ) : (
        <CustomerTable 
            customers={data?.items ?? []} 
            // No pagination prop needed as CustomerTable handles it client-side now
        />
      )}
    </div>
  );
}

// Main page component
export default function CustomersPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">Customers</h1>
       <Suspense fallback={<div>Loading...</div>}>
         <CustomerListContent />
       </Suspense>
    </div>
  );
} 