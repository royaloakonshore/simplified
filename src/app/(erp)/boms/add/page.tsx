'use client';

import { BOMForm } from "@/components/boms/BOMForm";
import { api } from "@/lib/trpc/react";
import { ItemType } from "@prisma/client"; // For ItemType enum
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

export default function AddBillOfMaterialPage() {
  // TODO: Replace placeholder companyId with actual companyId from session/context
  // This page currently doesn't filter inventory by companyId for selections, 
  // as listInventoryItemsSchema doesn't support it yet.
  const companyIdPlaceholder = "clxjv0l1s0000108kjrdy1z4h"; // Used for BOMForm prop, not for inventory list query

  const { data: manufacturedGoodsData, isLoading: isLoadingManGoods, error: errorManGoods } = api.inventory.list.useQuery({
    // No companyId here as listInventoryItemsSchema does not take it
    itemType: ItemType.MANUFACTURED_GOOD,
    perPage: 100, // Fetch a large number, adjusted to schema max
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const { data: rawMaterialsData, isLoading: isLoadingRawMat, error: errorRawMat } = api.inventory.list.useQuery({
    // No companyId here as listInventoryItemsSchema does not take it
    itemType: ItemType.RAW_MATERIAL,
    perPage: 100, // Fetch a large number, adjusted to schema max
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  const isLoading = isLoadingManGoods || isLoadingRawMat;
  const BOMErrors = [errorManGoods, errorRawMat].filter(Boolean);

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Create New Bill of Material</h1>
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (BOMErrors.length > 0) {
    return (
      <div className="container mx-auto py-10 text-red-500">
        <h1 className="text-3xl font-bold mb-8">Error loading data</h1>
        {BOMErrors.map((err, idx) => <p key={idx}>{err?.message || "An unknown error occurred"}</p>)}
      </div>
    );
  }

  const manufacturedItems = manufacturedGoodsData?.data || [];
  const rawMaterials = rawMaterialsData?.data || [];

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Create New Bill of Material</h1>
      <BOMForm 
        manufacturedItems={manufacturedItems}
        rawMaterials={rawMaterials}
        companyId={companyIdPlaceholder} // Pass companyId to the form
      />
    </div>
  );
} 