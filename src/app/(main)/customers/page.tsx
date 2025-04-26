'use client';

import * as React from "react";
import { api } from "@/lib/trpc/react";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// TODO: Implement proper pagination state and controls

export default function CustomersPage() {
  // Using useInfiniteQuery for potential pagination later
  const { data, isLoading, fetchNextPage, hasNextPage }
    = api.customer.list.useInfiniteQuery(
    {
      limit: 10, // Fetch 10 items per page
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor, // Use the cursor for the next page
      initialCursor: null, // Start from the beginning
    }
  );

  // Flatten the pages array into a single list of customers
  const customers = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Link href="/customers/add" passHref>
          <Button>Add Customer</Button>
        </Link>
      </div>

      <CustomerTable customers={customers} isLoading={isLoading} />

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => fetchNextPage()} disabled={isLoading}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
} 