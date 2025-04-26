'use client';

import * as React from "react";
import { useParams } from 'next/navigation';
import { api } from "@/lib/trpc/react";
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";

export default function EditInventoryItemPage() {
  const params = useParams();
  const itemId = params?.id as string;

  const { data: item, isLoading, error } = api.inventory.getById.useQuery(
    { id: itemId },
    {
      enabled: !!itemId, // Only run query if itemId is available
    }
  );

  if (isLoading) {
    // TODO: Add Skeleton Loader
    return <div>Loading item data...</div>;
  }

  if (error) {
    return <div>Error loading item: {error.message}</div>;
  }

  if (!item) {
    return <div>Inventory item not found.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Edit Item: {item.name} ({item.sku})</h1>
      <InventoryItemForm initialData={item} />
    </div>
  );
} 