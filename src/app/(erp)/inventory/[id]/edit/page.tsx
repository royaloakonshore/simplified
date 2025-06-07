"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm, type ProcessedInventoryItemApiData } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type UpdateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { TRPCClientErrorLike } from '@trpc/react-query';
import type { AppRouter } from "@/lib/api/root";
import { type ItemType as PrismaItemType } from '@prisma/client';
import { useSession } from 'next-auth/react';

// Define a common type for selectable items in dropdowns
interface SelectableItem {
  value: string;
  label: string;
}

// Ensure itemFromApi and categoriesData are correctly typed before mapping
// Define type for category items if not already available globally
type CategoryListItem = { id: string; name: string; companyId: string | null; createdAt: Date; updatedAt: Date };

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.id as string;
  const utils = api.useUtils();
  const { data: session, status: sessionStatus } = useSession();
  const userCompanyId = session?.user?.activeCompanyId;

  const formModeQuery = searchParams.get('mode');
  const currentFormMode: 'scan-edit' | 'full' = (formModeQuery === 'scan-edit') ? 'scan-edit' : 'full';

  const { data: itemFromApi, isLoading, error } = api.inventory.getById.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  const { data: categoriesData, isLoading: isLoadingCategories } = api.inventoryCategory.list.useQuery(
    undefined, // Assuming list endpoint doesn't take companyId as input, uses context
    { enabled: !!userCompanyId && sessionStatus === "authenticated" } 
  );

  const updateItemMutation = api.inventory.update.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item "${data.name}" updated successfully!`);
      utils.inventory.list.invalidate();
      utils.inventory.getById.invalidate({ id: itemId });
      router.push("/inventory");
      router.refresh();
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  const quickAdjustStockMutation = api.inventory.quickAdjustStock.useMutation({
    onSuccess: (data) => {
      toast.success(`Stock for "${data.name}" (SKU: ${data.sku}) updated. New QOH: ${data.quantityOnHand}`);
      utils.inventory.list.invalidate();
      utils.inventory.getById.invalidate({ id: itemId });
      router.refresh();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Error adjusting stock: ${error.message}`);
    },
  });

  const onSubmitProp = (values: InventoryItemFormValues, mode: 'full' | 'scan-edit', newAbsoluteQuantityOnHand?: number) => {
    if (!itemFromApi) {
      toast.error("Cannot submit, item data not loaded or found.");
      return;
    }

    if (mode === "full") {
      const updatePayload: UpdateInventoryItemInput = {
        id: itemFromApi.id,
        sku: values.sku,
        name: values.name,
        description: values.description,
        unitOfMeasure: values.unitOfMeasure,
        itemType: values.itemType,
        inventoryCategoryId: values.inventoryCategoryId,
        costPrice: values.costPrice,
        salesPrice: values.salesPrice,
        minimumStockLevel: values.minimumStockLevel,
        reorderLevel: values.reorderLevel,
        defaultVatRatePercent: values.defaultVatRatePercent,
        showInPricelist: values.showInPricelist,
        internalRemarks: values.internalRemarks,
        quantityOnHand: values.quantityOnHand,
        leadTimeDays: values.leadTimeDays,
        vendorSku: values.vendorSku,
        vendorItemName: values.vendorItemName,
      };
      updateItemMutation.mutate(updatePayload);

    } else if (mode === "scan-edit") {
      if (newAbsoluteQuantityOnHand !== undefined && newAbsoluteQuantityOnHand !== null) {
        const originalQOH = parseFloat(itemFromApi.quantityOnHand);
        if (isNaN(originalQOH)) {
            toast.error("Original quantity on hand is invalid. Cannot perform scan adjustment.");
            return;
        }
        quickAdjustStockMutation.mutate({ 
            itemId: itemFromApi.id, 
            newQuantityOnHand: newAbsoluteQuantityOnHand,
            originalQuantityOnHand: originalQOH,
            note: "Quick update via scan"
        });
      } else {
        toast.info("No quantity change entered for scan adjustment.");
      }
    }
  };

  const isLoadingPageData = isLoading || isLoadingCategories;

  if (isLoadingPageData && itemId) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold mb-6">Edit Inventory Item</h1>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-1/4 ml-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold mb-6">Edit Inventory Item</h1>
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error loading inventory item</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!itemFromApi) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold mb-6">Edit Inventory Item</h1>
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Inventory Item Not Found</AlertTitle>
          <AlertDescription>
            The inventory item you are trying to edit could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectableCategories: SelectableItem[] = 
    (categoriesData as CategoryListItem[] | undefined)?.map((cat: CategoryListItem) => ({ value: cat.id, label: cat.name })) || [];

  const formInitialData: ProcessedInventoryItemApiData = {
    id: itemFromApi.id,
    sku: itemFromApi.sku ?? null,
    name: itemFromApi.name,
    description: itemFromApi.description ?? null,
    unitOfMeasure: itemFromApi.unitOfMeasure ?? null,
    itemType: itemFromApi.itemType as PrismaItemType,
    inventoryCategoryId: itemFromApi.inventoryCategoryId ?? null,
    costPrice: itemFromApi.costPrice as string, // Expected as string by ProcessedInventoryItemApiData
    salesPrice: itemFromApi.salesPrice as string, // Expected as string
    minimumStockLevel: itemFromApi.minimumStockLevel as string, // Expected as string
    reorderLevel: itemFromApi.reorderLevel as (string | null), // Expected as string | null
    quantityOnHand: itemFromApi.quantityOnHand as string, // Expected as string
    defaultVatRatePercent: itemFromApi.defaultVatRatePercent !== null && itemFromApi.defaultVatRatePercent !== undefined 
                            ? parseFloat(itemFromApi.defaultVatRatePercent.toString()) 
                            : null, // This remains number | null, assuming it's correct
    qrIdentifier: itemFromApi.qrIdentifier ?? null,
    showInPricelist: itemFromApi.showInPricelist ?? true,
    internalRemarks: itemFromApi.internalRemarks ?? null,
    createdAt: itemFromApi.createdAt ? new Date(itemFromApi.createdAt) : undefined,
    updatedAt: itemFromApi.updatedAt ? new Date(itemFromApi.updatedAt) : undefined,
    leadTimeDays: itemFromApi.leadTimeDays !== null && itemFromApi.leadTimeDays !== undefined 
                    ? Number(itemFromApi.leadTimeDays) 
                    : null,
    vendorSku: itemFromApi.vendorSku ?? null,
    vendorItemName: itemFromApi.vendorItemName ?? null,
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">
        {currentFormMode === 'scan-edit' ? 'Quick Update Item' : 'Edit Inventory Item'}: {itemFromApi.name}
      </h1>
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={onSubmitProp} 
            initialData={formInitialData}
            isLoading={updateItemMutation.isPending || quickAdjustStockMutation.isPending}
            formMode={currentFormMode}
            inventoryCategories={selectableCategories}
          />
        </CardContent>
      </Card>
    </div>
  );
} 