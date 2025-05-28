"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm, type ProcessedInventoryItemApiData } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type UpdateInventoryItemInput, adjustStockFormSchema, InventoryTransactionType, type AdjustStockFormValues, type AdjustStockInput } from '@/lib/schemas/inventory.schema';
import { z } from 'zod';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TRPCClientErrorLike } from '@trpc/react-query';
import type { InventoryItem, InventoryTransaction, ItemType } from '@prisma/client';
import type { AppRouter } from "@/lib/api/root";
import { type ItemType as PrismaItemType } from '@prisma/client';

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.id as string;
  const utils = api.useUtils();

  const formModeQuery = searchParams.get('mode');
  const currentFormMode: 'scan-edit' | 'full' = (formModeQuery === 'scan-edit') ? 'scan-edit' : 'full';

  const { data: itemFromApiAny, isLoading, error, refetch: refetchItem } = api.inventory.getById.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  const {
    handleSubmit: handleSubmitAdjustStock,
    control: controlAdjustStock,
    reset: resetAdjustStock,
    formState: { errors: errorsAdjustStock },
  } = useForm<AdjustStockFormValues>({
    resolver: zodResolver(adjustStockFormSchema as z.Schema<AdjustStockFormValues>),
    defaultValues: {
      itemId: itemId,
      quantityChange: 0,
      note: "Manual adjustment from edit page",
    },
  });

  const updateAndAdjustStockMutation = api.inventory.updateAndAdjustStock.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item ${data.item.name} updated and stock adjusted successfully.`);
      utils.inventory.getById.invalidate({ id: itemId });
      utils.inventory.list.invalidate();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to update item/adjust stock: ${error.message}`);
    },
  });

  const adjustStockScanMutation = api.inventory.adjustStockFromScan.useMutation({
    onSuccess: (data: { success: boolean, message: string }) => {
      toast.success(data.message);
      utils.inventory.getById.invalidate({ id: itemId });
      utils.inventory.list.invalidate();
      resetAdjustStock(); 
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to adjust stock by scan: ${error.message}`);
    },
  });

  const onSubmitProp = (values: InventoryItemFormValues | AdjustStockFormValues, mode: 'full' | 'scan-edit', stockAdjustmentAmount?: number) => {
    if (mode === "full" && itemFromApiAny) {
      const { quantityOnHand, ...formValues } = values as InventoryItemFormValues;
      
      const updateData: UpdateInventoryItemInput = {
        id: itemFromApiAny.id,
        name: formValues.name,
        sku: formValues.sku,
        description: formValues.description,
        unitOfMeasure: formValues.unitOfMeasure,
        itemType: formValues.itemType,
        inventoryCategoryId: formValues.inventoryCategoryId,
        costPrice: Number(formValues.costPrice),
        salesPrice: Number(formValues.salesPrice),
        minimumStockLevel: Number(formValues.minimumStockLevel),
        reorderLevel: formValues.reorderLevel !== undefined ? Number(formValues.reorderLevel) : undefined,
        defaultVatRatePercent: formValues.defaultVatRatePercent !== undefined ? Number(formValues.defaultVatRatePercent) : undefined,
        showInPricelist: formValues.showInPricelist,
        internalRemarks: formValues.internalRemarks,
      };
      
      updateAndAdjustStockMutation.mutate({
        itemData: updateData,
        stockAdjustment: stockAdjustmentAmount ?? 0,
        adjustmentNote: "Manual adjustment from item edit page",
      });

    } else if (mode === "scan-edit" && itemFromApiAny) {
      const adjustmentValue = stockAdjustmentAmount ?? ('quantityChange' in values ? Number(values.quantityChange) : 0);
      if (adjustmentValue !== 0) {
         adjustStockScanMutation.mutate({ 
            itemId: itemFromApiAny.id, 
            quantityAdjustment: adjustmentValue,
        });
      } else {
        toast.info("No quantity change entered for scan adjustment.")
      }
    }
  };

  if (isLoading) {
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

  if (!itemFromApiAny) {
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

  const itemFromApi = itemFromApiAny as any;

  const formInitialData: ProcessedInventoryItemApiData = {
    id: itemFromApi.id,
    sku: itemFromApi.sku ?? null,
    name: itemFromApi.name,
    description: itemFromApi.description ?? null,
    unitOfMeasure: itemFromApi.unitOfMeasure ?? null,
    itemType: itemFromApi.itemType as PrismaItemType,
    inventoryCategoryId: itemFromApi.inventoryCategoryId ?? null,
    costPrice: itemFromApi.costPrice,
    salesPrice: itemFromApi.salesPrice,
    minimumStockLevel: itemFromApi.minimumStockLevel,
    reorderLevel: itemFromApi.reorderLevel,
    quantityOnHand: itemFromApi.quantityOnHand,
    defaultVatRatePercent: itemFromApi.defaultVatRatePercent 
                            ? parseFloat(itemFromApi.defaultVatRatePercent.toString()) 
                            : undefined,
    qrIdentifier: itemFromApi.qrIdentifier ?? null,
    showInPricelist: itemFromApi.showInPricelist ?? true,
    internalRemarks: itemFromApi.internalRemarks ?? null,
    createdAt: itemFromApi.createdAt ? new Date(itemFromApi.createdAt) : undefined,
    updatedAt: itemFromApi.updatedAt ? new Date(itemFromApi.updatedAt) : undefined,
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
            isLoading={updateAndAdjustStockMutation.isLoading || adjustStockScanMutation.isLoading}
            formMode={currentFormMode}
          />
        </CardContent>
      </Card>
    </div>
  );
} 