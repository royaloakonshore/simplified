'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation'; // Added for pagination
import { api } from "@/lib/trpc/react";
import CustomerTable from '@/components/customers/CustomerTable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { debounce } from 'lodash'; // Assuming lodash is installed
import React from 'react';

// Component to handle fetching and displaying data
function CustomerListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get pagination and filter state from URL
  const page = Number(searchParams.get('page') ?? 1);
  const perPage = Number(searchParams.get('perPage') ?? 10);
  const search = searchParams.get('search') ?? undefined;
  const sortBy = (searchParams.get('sortBy') as 'name' | 'email' | 'createdAt') ?? 'name';
  const sortDirection = (searchParams.get('sortDirection') as 'asc' | 'desc') ?? 'asc';

  // Fetch data using tRPC
  const { data, error, isLoading } = api.customer.list.useQuery({
    page,
    perPage,
    search,
    sortBy,
    sortDirection,
  });

  // Debounced search handler
  const debouncedSearch = React.useCallback(
    debounce((value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      params.set('page', '1'); // Reset to page 1 on search
      router.push(`${pathname}?${params.toString()}`);
    }, 500), // 500ms debounce
    [searchParams, router, pathname]
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(event.target.value);
  };

  if (error) {
    return <div className="text-red-600">Error loading customers: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search name or email..."
          defaultValue={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
         <Button asChild>
           <Link href="/customers/add">Create New Customer</Link>
         </Button>
      </div>
      {isLoading && !data ? (
        <div>Loading customers...</div> // TODO: Add Skeleton
      ) : (
        <CustomerTable 
            customers={data?.items ?? []} 
            pagination={data?.pagination ?? { page: 1, perPage: 10, totalCount: 0, totalPages: 1 }} 
            // Pass pagination change handler here if needed
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