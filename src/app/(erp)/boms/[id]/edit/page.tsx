'use client';

import { BOMForm, type BOMFormProps, type SelectableInventoryItem } from "@/components/boms/BOMForm";
import { type RawMaterialRow } from "@/components/boms/RawMaterialSelectionTable";
import { api } from "@/lib/trpc/react";
import { ItemType } from "@prisma/client";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react"; // Import useSession
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

// Define a type for the data returned by api.inventory.list.useQuery
interface FetchedInventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  itemType: ItemType;
  unitOfMeasure?: string | null;
  variant?: string | null;
  inventoryCategory?: { id: string; name: string } | null;
}

// Define a type for the data returned by api.bom.get.useQuery
// This should align with what bom.get now returns (Decimals converted to numbers)
interface FetchedBOMData {
  id: string;
  name: string;
  description?: string | null;
  manufacturedItemId?: string | null;
  companyId: string | null;
  manualLaborCost: number; 
  items: Array<{
    id: string;
    componentItemId: string;
    quantity: number; 
    componentItem: {
        id: string;
        name: string;
        sku?: string | null;
        unitOfMeasure?: string | null;
        variant?: string | null;
        inventoryCategory?: { name: string } | null;
    }
  }>;
}

export default function EditBillOfMaterialPage() {
  const params = useParams();
  const bomId = typeof params.id === 'string' ? params.id : '';
  const { data: session, status: sessionStatus } = useSession();
  const userCompanyId = session?.user?.companyId; // User's current company context

  // Common query options for inventory lists
  const inventoryQueryOptions = { 
    perPage: 100,
    page: 1,
    sortBy: 'name' as const,
    sortDirection: 'asc' as const,
  };

  // Fetch BOM data - enable only if bomId and userCompanyId are available
  const { data: bomData, isLoading: isLoadingBOM, error: errorBOM } = api.bom.get.useQuery(
    { id: bomId, companyId: userCompanyId! }, // Pass userCompanyId for scoping
    { enabled: !!bomId && !!userCompanyId && sessionStatus === "authenticated" }
  ) as { data?: FetchedBOMData; isLoading: boolean; error: any }; // Add type assertion for bomData

  // Fetch manufactured goods - enable only if userCompanyId is available
  const { data: manufacturedGoodsData, isLoading: isLoadingManGoods, error: errorManGoods } = api.inventory.list.useQuery(
    { ...inventoryQueryOptions, itemType: ItemType.MANUFACTURED_GOOD, companyId: userCompanyId! },
    { enabled: !!userCompanyId && sessionStatus === "authenticated" }
  );

  // Fetch raw materials - enable only if userCompanyId is available
  const { data: rawMaterialsInventoryData, isLoading: isLoadingRawMat, error: errorRawMat } = api.inventory.list.useQuery(
    { ...inventoryQueryOptions, itemType: ItemType.RAW_MATERIAL, companyId: userCompanyId! },
    { enabled: !!userCompanyId && sessionStatus === "authenticated" }
  );

  // --- Start of Loading and Permission Checks ---
  if (sessionStatus === "loading") {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Edit Bill of Material</h1>
        <p>Loading session information...</p>
        {/* Add Skeletons for form structure */}
        <Skeleton className="h-10 w-full mb-4" /> 
        <Skeleton className="h-20 w-full mb-4" /> 
        <Skeleton className="h-64 w-full mb-4" /> 
      </div>
    );
  }
  
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You must be logged in to edit a Bill of Material.</AlertDescription>
        </Alert>
      </div>
    );
  }

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

  // If authenticated but no companyId, user can't proceed
  if (sessionStatus === "authenticated" && !userCompanyId) {
    return (
      <div className="container mx-auto py-10">
         <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Company Not Found</AlertTitle>
          <AlertDescription>Your user account is not associated with a company. Please contact support.</AlertDescription>
        </Alert>
      </div>
    );
  }
  // --- End of Loading and Permission Checks ---

  const isLoadingPageData = isLoadingBOM || isLoadingManGoods || isLoadingRawMat;
  const pageErrors = [errorBOM, errorManGoods, errorRawMat].filter(Boolean);

  // Show loading skeleton if any primary data is still loading (and we have context to load it)
  if (isLoadingPageData && bomId && userCompanyId) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Edit Bill of Material</h1>
        <p>Loading data...</p>
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Skeleton className="h-20 w-full mb-4" />
        <Skeleton className="h-10 w-1/2 mb-4" />
        <h3 className="text-lg font-medium mb-2 mt-6">Component Items</h3>
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-10 w-1/4 mb-4 mt-6" />
        <Skeleton className="h-10 w-24 mt-8" />
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

  // This implies that bom.get query finished, but found nothing (e.g. wrong bomId or company mismatch)
  if (!bomData && !isLoadingBOM && bomId && userCompanyId) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Bill of Material with ID {bomId} not found or not accessible for your company.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Fallback if bomData is unexpectedly null after loading and no error
  if (!bomData) {
      return (
          <div className="container mx-auto py-10">
              <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Data Incomplete</AlertTitle>
                  <AlertDescription>Could not load Bill of Material details. Please try again or contact support.</AlertDescription>
              </Alert>
          </div>
      );
  }

  // Map inventory items for dropdowns and table
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
  
  // First, determine the companyId that MUST be a string.
  const determinedCompanyId = bomData.companyId || userCompanyId;

  if (!determinedCompanyId) {
    // This critical error means we cannot proceed to build form data or render the form.
    return (
        <div className="container mx-auto py-10">
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Critical Error</AlertTitle>
                <AlertDescription>
                Cannot establish company context for the form. Please contact support.
                </AlertDescription>
            </Alert>
        </div>
    );
  }
  // At this point, determinedCompanyId is guaranteed to be a string.

  const initialFormData: BOMFormProps['initialData'] = {
    id: bomData.id,
    name: bomData.name,
    description: bomData.description,
    manufacturedItemId: bomData.manufacturedItemId,
    companyId: determinedCompanyId, // Use the guarded string value
    manualLaborCost: bomData.manualLaborCost, 
    items: bomData.items?.map((item: FetchedBOMData['items'][number]) => ({ 
      componentItemId: item.componentItemId,
      quantity: item.quantity, 
    })),
  };

  // The companyId prop for BOMForm also uses the guarded determinedCompanyId.
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Edit Bill of Material: {bomData.name}</h1>
      <BOMForm 
        initialData={initialFormData}
        manufacturedItems={selectableManufacturedItems}
        rawMaterials={rawMaterialsForTable}
        companyId={determinedCompanyId} // This was already correct from previous focus
      />
    </div>
  );
} 