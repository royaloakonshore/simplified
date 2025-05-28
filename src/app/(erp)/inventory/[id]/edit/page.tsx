"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type UpdateInventoryItemInput, adjustStockFormSchema, InventoryTransactionType, type AdjustStockFormValues } from '@/lib/schemas/inventory.schema';
import { z } from 'zod';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TRPCClientErrorLike } from '@trpc/react-query';
import type { InventoryItem } from '@prisma/client';
import type { AppRouter } from "@/lib/api/root";

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.id as string;
  const utils = api.useUtils();

  const formModeQuery = searchParams.get('mode');
  const currentFormMode: 'scan-edit' | 'full' = (formModeQuery === 'scan-edit') ? 'scan-edit' : 'full';

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
    resolver: zodResolver(adjustStockFormSchema as z.Schema<AdjustStockFormValues>),
    defaultValues: {
      itemId: itemId,
      quantityChange: 1,
      note: "",
    },
  });

  const updateMutation = api.inventory.update.useMutation({
    onSuccess: (data: InventoryItem) => {
      toast.success(`Inventory item ${data.name} updated successfully.`);
      utils.inventory.getById.invalidate({ id: itemId });
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  const adjustStockScanMutation = api.inventory.adjustStockFromScan.useMutation({
    onSuccess: (data: { success: boolean, message: string }) => {
      toast.success(data.message);
      utils.inventory.getById.invalidate({ id: itemId });
      resetAdjustStock(); 
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to adjust stock by scan: ${error.message}`);
    },
  });

  const onSubmitProp = (data: InventoryItemFormValues | AdjustStockFormValues) => {
    if (currentFormMode === "full") {
      if ('name' in data && item) {
        const updateData: UpdateInventoryItemInput = { 
          id: item.id, 
          ...data,
          costPrice: data.costPrice !== null && data.costPrice !== undefined ? Number(data.costPrice) : 0,
          salesPrice: data.salesPrice !== null && data.salesPrice !== undefined ? Number(data.salesPrice) : 0,
          minimumStockLevel: data.minimumStockLevel !== null && data.minimumStockLevel !== undefined ? Number(data.minimumStockLevel) : 0,
          reorderLevel: data.reorderLevel !== null && data.reorderLevel !== undefined ? Number(data.reorderLevel) : 0,
        };
        updateMutation.mutate(updateData);
      }
    } else if (currentFormMode === "scan-edit") {
      if ('quantityChange' in data && item) {
        adjustStockScanMutation.mutate({ 
          itemId: item.id, 
          quantityAdjustment: Number(data.quantityChange),
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