'use client';

import { BOMForm, type SelectableInventoryItem } from "@/components/boms/BOMForm";
import { type RawMaterialRow } from "@/components/boms/RawMaterialSelectionTable";
import { api } from "@/lib/trpc/react";
import { ItemType } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";

// Define a type for the data returned by api.inventory.list.useQuery
// This should match the actual structure including relational data like inventoryCategory
// and ensure all fields needed by BOMForm (SelectableInventoryItem) and RawMaterialSelectionTable (RawMaterialRow) are present.
interface FetchedInventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  itemType: ItemType;
  unitOfMeasure?: string | null;
  variant?: string | null;
  inventoryCategory?: { id: string; name: string } | null;
  // Add other fields if necessary, but these cover the current needs
}

export default function AddBillOfMaterialPage() {
  const { data: session, status: sessionStatus } = useSession();
  const companyId = session?.user?.activeCompanyId;

  // Initial query enabled state is false, will be enabled once companyId is available
  const queryOptions = { 
    perPage: 100,
    page: 1,
    sortBy: 'name' as const, // Ensure sortBy is a literal type
    sortDirection: 'asc' as const,
  };

  const { data: manufacturedGoodsData, isLoading: isLoadingManGoods, error: errorManGoods } = api.inventory.list.useQuery(
    { ...queryOptions, itemType: ItemType.MANUFACTURED_GOOD, companyId: companyId! },
    { enabled: !!companyId && sessionStatus === "authenticated" } // Enable only when companyId is available
  );

  const { data: rawMaterialsInventoryData, isLoading: isLoadingRawMat, error: errorRawMat } = api.inventory.list.useQuery(
    { ...queryOptions, itemType: ItemType.RAW_MATERIAL, companyId: companyId! },
    { enabled: !!companyId && sessionStatus === "authenticated" } // Enable only when companyId is available
  );

  if (sessionStatus === "loading") {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Create New Bill of Material</h1>
        <p>Loading session information...</p>
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be logged in to create a Bill of Material.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If authenticated but no companyId, it means user is not linked to a company
  if (sessionStatus === "authenticated" && !companyId) {
    return (
      <div className="container mx-auto py-10">
         <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Company Not Found</AlertTitle>
          <AlertDescription>
            Your user account is not associated with a company. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoadingData = isLoadingManGoods || isLoadingRawMat;
  const BOMErrors = [errorManGoods, errorRawMat].filter(Boolean);

  if (isLoadingData && companyId) { // Only show loading for data if companyId is present
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Create New Bill of Material</h1>
        <p>Loading inventory items...</p>
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

  // Map fetched data to the types expected by child components
  const fetchedMfgItems: FetchedInventoryItem[] = manufacturedGoodsData?.data as FetchedInventoryItem[] || [];
  const selectableManufacturedItems: SelectableInventoryItem[] = fetchedMfgItems.map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
  }));

  const fetchedRawMaterials: FetchedInventoryItem[] = rawMaterialsInventoryData?.data as FetchedInventoryItem[] || [];
  const rawMaterialsForTable: RawMaterialRow[] = fetchedRawMaterials.map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    categoryName: item.inventoryCategory?.name || null,
    unitOfMeasure: item.unitOfMeasure,
    variant: item.variant,
  }));

  // This check is important: only render form if companyId is confirmed
  if (!companyId) {
     // This case should ideally be caught by earlier checks, but as a fallback:
    return (
        <div className="container mx-auto py-10">
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>
                Cannot determine company context. Please try again or contact support.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <PageBanner>
        <BannerTitle>Create New Bill of Material</BannerTitle>
      </PageBanner>
      <BOMForm 
        manufacturedItems={selectableManufacturedItems}
        rawMaterials={rawMaterialsForTable}
      />
    </div>
  );
} 