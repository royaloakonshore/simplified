"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { type InventoryItemFormValues } from '@/lib/schemas/inventory.schema';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { AdjustStockFormValues, adjustStockFormSchema } from '@/lib/schemas/inventory.schema';
import { InventoryTransactionType } from '@/lib/schemas/inventory.schema';
import { utils } from '@/lib/trpc/react';
import { FullPageLoader } from '@/components/FullPageLoader';

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.id as string;

  const formModeQuery = searchParams.get('mode');
  const currentFormMode = (formModeQuery === 'scan-edit') ? 'scan-edit' : 'full';

  const { data: item, isLoading, error, refetch: refetchItem } = api.inventory.getById.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  const {
    handleSubmit: handleSubmitAdjustStock,
    control: controlAdjustStock,
    reset: resetAdjustStock,
    formState: { errors: errorsAdjustStock },
  } = useForm<AdjustStockFormValues>({
    resolver: zodResolver(adjustStockFormSchema),
    defaultValues: {
      quantity: 1,
      type: InventoryTransactionType.ADJUSTMENT, // Default to ADJUSTMENT
      notes: "",
    },
  });

  const updateMutation = api.inventory.update.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item ${data.name} updated successfully.`);
      utils.inventory.getById.invalidate({ id });
      // refetch(); // already done by invalidate
      if (currentFormMode === "edit") {
        // Potentially switch back to view or stay in edit mode
      }
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  const adjustStockScanMutation = api.inventory.adjustStockByScan.useMutation({
    onSuccess: (data) => {
      toast.success(`Stock adjusted successfully for item via scan. New quantity: ${data.updatedItem.quantityOnHand}`);
      utils.inventory.getById.invalidate({ id });
      resetAdjustStock(); 
    },
    onError: (error) => {
      toast.error(`Failed to adjust stock by scan: ${error.message}`);
    },
  });

  const onSubmitProp = (data: InventoryItemFormValues | AdjustStockFormValues) => {
    if (currentFormMode === "edit" || currentFormMode === "create") {
      // Type guard to ensure data is InventoryItemFormValues
      if ('name' in data) { 
        const updateData: UpdateInventoryItemInput = { 
          id: item.id, 
          ...data,
          costPrice: data.costPrice !== null && data.costPrice !== undefined ? Number(data.costPrice) : null,
          salesPrice: data.salesPrice !== null && data.salesPrice !== undefined ? Number(data.salesPrice) : null,
          minStockLevel: data.minStockLevel !== null && data.minStockLevel !== undefined ? Number(data.minStockLevel) : null,
          reorderLevel: data.reorderLevel !== null && data.reorderLevel !== undefined ? Number(data.reorderLevel) : null,
        };
        updateMutation.mutate(updateData);
      }
    } else if (currentFormMode === "adjustStock") {
      // Type guard to ensure data is AdjustStockFormValues
      if ('quantity' in data && 'type' in data) {
        adjustStockScanMutation.mutate({ 
          itemId: item.id, // item.id should be available from the page context
          quantity: Number(data.quantity), 
          type: data.type as InventoryTransactionType, 
          notes: data.notes, 
          qrIdentifier: item.qrIdentifier || undefined // Pass QR identifier if available
        });
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

  if (!item) {
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

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">
        {currentFormMode === 'scan-edit' ? 'Quick Update Item' : 'Edit Inventory Item'}: {item.name}
      </h1>
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={onSubmitProp} 
            initialData={item}
            isLoading={updateMutation.isLoading || adjustStockScanMutation.isLoading}
            formMode={currentFormMode}
          />
        </CardContent>
      </Card>
    </div>
  );
} 