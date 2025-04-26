'use client';

import * as React from "react";
import { api } from "@/lib/trpc/react";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// TODO: Implement pagination

export default function InventoryPage() {
  // Using useInfiniteQuery for potential pagination later
  const { data, isLoading, fetchNextPage, hasNextPage }
    = api.inventory.list.useInfiniteQuery(
    {
      limit: 15, // Fetch 15 items per page
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: null,
    }
  );

  const inventoryItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Inventory Items</h1>
        {/* TODO: Add CSV Import/Export buttons */}
        <Link href="/inventory/add" passHref>
          <Button>Add Item</Button>
        </Link>
      </div>

      <InventoryTable items={inventoryItems} isLoading={isLoading} />

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