"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { Card, CardContent } from "@/components/ui/card";
import type { TRPCClientErrorLike } from "@trpc/react-query";
import type { AppRouter } from "@/lib/api/root";
// import { Heading } from "@/components/ui/heading"; // If you have a standard heading component
// import { Separator } from "@/components/ui/separator"; // If you use a standard separator

export default function AddInventoryItemPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const createAndAdjustStockMutation = api.inventory.createAndAdjustStock.useMutation({
    onSuccess: () => {
      toast.success('Inventory item created successfully with initial stock!');
      utils.inventory.list.invalidate(); // Invalidate list to show new item
      // Potentially invalidate item detail if navigating there, or quantityOnHand queries
      router.push('/inventory');
    },
    onError: (err: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to create item: ${err.message}`);
    },
  });

  const handleSubmit = (values: InventoryItemFormValues, mode: 'full' | 'scan-edit', initialStockValue?: number) => {
    // For creation, initialStockValue comes from values.quantityOnHand in the form
    const initialStock = initialStockValue ?? 0;
    
    const dataToSubmit: CreateInventoryItemInput = {
        ...values,
        // quantityOnHand is not part of CreateInventoryItemInput, it's handled separately
        // Ensure costPrice and salesPrice are numbers
        costPrice: values.costPrice ?? 0,
        salesPrice: values.salesPrice ?? 0,
    };

    // Remove quantityOnHand from dataToSubmit if it exists, as it's passed separately
    const { quantityOnHand, ...itemData } = dataToSubmit as InventoryItemFormValues;

    createAndAdjustStockMutation.mutate({ 
        itemData: itemData as CreateInventoryItemInput, // Cast needed after removing quantityOnHand
        initialStockQuantity: initialStock 
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">Add New Inventory Item</h1>
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={handleSubmit}
            isLoading={createAndAdjustStockMutation.isLoading}
            formMode="full"
          />
        </CardContent>
      </Card>
    </div>
  );
} 