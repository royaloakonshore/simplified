"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TRPCClientErrorLike } from "@trpc/react-query";
import type { AppRouter } from "@/lib/api/root";
// import { Heading } from "@/components/ui/heading"; // If you have a standard heading component
// import { Separator } from "@/components/ui/separator"; // If you use a standard separator

export default function AddInventoryItemPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const createAndAdjustStockMutation = api.inventory.createAndAdjustStock.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item ${data.name} created successfully!`);
      router.push("/inventory");
      router.refresh(); 
    },
    onError: (error) => {
      toast.error(`Failed to create inventory item: ${error.message}`);
    },
  });

  const handleSubmit = async (values: InventoryItemFormValues) => {
    const qty = Number(values.quantityOnHand);
    const initialStock = !isNaN(qty) ? qty : 0;

    createAndAdjustStockMutation.mutate({
      itemData: values, 
      initialStockQuantity: initialStock,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Add New Inventory Item</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={handleSubmit}
            isLoading={createAndAdjustStockMutation.isPending}
            formMode="full"
          />
        </CardContent>
      </Card>
    </div>
  );
} 