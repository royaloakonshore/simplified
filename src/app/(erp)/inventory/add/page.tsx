"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from 'react-toastify';
import { type InventoryItemFormValues, type CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { Card, CardContent } from "@/components/ui/card";
// import { Heading } from "@/components/ui/heading"; // If you have a standard heading component
// import { Separator } from "@/components/ui/separator"; // If you use a standard separator

export default function AddInventoryItemPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const createMutation = api.inventory.create.useMutation({
    onSuccess: () => {
      toast.success('Inventory item created successfully!');
      utils.inventory.list.invalidate();
      router.push('/inventory');
    },
    onError: (err) => {
      toast.error(`Failed to create item: ${err.message}`);
    },
  });

  const handleSubmit = (values: InventoryItemFormValues, mode: 'full' | 'scan-edit', quantityAdjustment?: number) => {
    const dataToSubmit: CreateInventoryItemInput = {
        ...values,
        salesPrice: values.salesPrice ?? 0,
    };
    createMutation.mutate(dataToSubmit);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">Add New Inventory Item</h1>
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={handleSubmit}
            isLoading={createMutation.isLoading}
            formMode="full"
          />
        </CardContent>
      </Card>
    </div>
  );
} 