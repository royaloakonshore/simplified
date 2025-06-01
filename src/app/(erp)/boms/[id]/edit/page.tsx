'use client';

import { BOMForm, type BOMFormProps } from "@/components/boms/BOMForm";
import { api } from "@/lib/trpc/react";
import { ItemType } from "@prisma/client";
import { useParams } from "next/navigation"; // To get [id] from route
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function EditBillOfMaterialPage() {
  const params = useParams();
  const bomId = typeof params.id === 'string' ? params.id : '';

  // TODO: Replace placeholder companyId with actual companyId from session/context
  const companyIdPlaceholder = "clxjv0l1s0000108kjrdy1z4h"; // Example CUID, replace!

  const { data: bomData, isLoading: isLoadingBOM, error: errorBOM } = api.bom.get.useQuery(
    { id: bomId, /* TODO: companyId: companyIdPlaceholder */ },
    { enabled: !!bomId } // Only run query if bomId is available
  );

  const { data: manufacturedGoodsData, isLoading: isLoadingManGoods, error: errorManGoods } = api.inventory.list.useQuery({
    itemType: ItemType.MANUFACTURED_GOOD,
    perPage: 100, // Adjusted to schema max
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
    // No companyId for now, as listInventoryItemsSchema does not support it
  });

  const { data: rawMaterialsData, isLoading: isLoadingRawMat, error: errorRawMat } = api.inventory.list.useQuery({
    itemType: ItemType.RAW_MATERIAL,
    perPage: 100, // Adjusted to schema max
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
    // No companyId for now
  });

  const isLoading = isLoadingBOM || isLoadingManGoods || isLoadingRawMat;
  const pageErrors = [errorBOM, errorManGoods, errorRawMat].filter(Boolean);

  if (!bomId) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>BOM ID is missing. Cannot load page.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Edit Bill of Material</h1>
        <Skeleton className="h-10 w-1/4 mb-4" /> {/* BOM Name */}
        <Skeleton className="h-20 w-full mb-4" /> {/* Description */}
        <Skeleton className="h-10 w-1/2 mb-4" /> {/* Manufactured Item */}
        <h3 className="text-lg font-medium mb-2 mt-6">Component Items</h3>
        <Skeleton className="h-20 w-full mb-4" /> {/* Item 1 */}
        <Skeleton className="h-20 w-full mb-4" /> {/* Item 2 */}
        <Skeleton className="h-10 w-1/4 mb-4 mt-6" /> {/* Manual Labor Cost */}
        <Skeleton className="h-10 w-24 mt-8" /> {/* Save Button */}
      </div>
    );
  }

  if (pageErrors.length > 0) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Error Loading Data for BOM Edit</h1>
        {pageErrors.map((err, idx) => (
          <Alert variant="destructive" key={idx} className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{err?.message || "An unknown error occurred"}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  }

  if (!bomData) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Bill of Material with ID {bomId} not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const manufacturedItems = manufacturedGoodsData?.data || [];
  const rawMaterials = rawMaterialsData?.data || [];

  // Prepare initialData for BOMForm, ensuring correct types
  const initialFormData: BOMFormProps['initialData'] = {
    id: bomData.id,
    name: bomData.name,
    description: bomData.description,
    manufacturedItemId: bomData.manufacturedItemId,
    companyId: bomData.companyId ?? undefined, // Coalesce null to undefined
    manualLaborCost: bomData.manualLaborCost?.toNumber(),
    items: bomData.items?.map(item => ({
      id: item.id, // Keep item id for keying or updates if form supports it
      componentItemId: item.componentItemId,
      quantity: item.quantity?.toNumber(), // Convert Decimal to number
    })),
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Edit Bill of Material: {bomData.name}</h1>
      <BOMForm 
        initialData={initialFormData}
        manufacturedItems={manufacturedItems}
        rawMaterials={rawMaterials}
        companyId={bomData.companyId || companyIdPlaceholder} // Prefer companyId from BOM data if available
      />
    </div>
  );
} 