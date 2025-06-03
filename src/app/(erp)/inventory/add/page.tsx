"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { type InventoryItemFormValues, type CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import type { TRPCClientErrorLike } from "@trpc/react-query"; // Not directly used
// import type { AppRouter } from "@/lib/api/root"; // Not directly used

export default function AddInventoryItemPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Use the new 'create' mutation from the inventory router
  const createItemMutation = api.inventory.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item "${data.name}" created successfully!`);
      utils.inventory.list.invalidate(); // Invalidate list to show the new item
      router.push("/inventory");
      router.refresh(); 
    },
    onError: (error) => {
      toast.error(`Failed to create inventory item: ${error.message}`);
    },
  });

  const handleSubmit = async (values: InventoryItemFormValues) => {
    // InventoryItemFormValues should align with CreateInventoryItemInput due to shared base schema
    // The 'quantityOnHand' from the form is the initial absolute quantity.
    // The new 'api.inventory.create' mutation handles this and the new fields.
    
    const createPayload: CreateInventoryItemInput = {
      ...values, // Spread all values from the form
      // Ensure numeric fields are correctly typed if InventoryItemFormValues has them as string | number
      costPrice: Number(values.costPrice),
      salesPrice: Number(values.salesPrice),
      minimumStockLevel: Number(values.minimumStockLevel),
      // quantityOnHand is part of values and should be number | undefined
      quantityOnHand: values.quantityOnHand !== undefined && values.quantityOnHand !== null ? Number(values.quantityOnHand) : 0,
      // Optional fields from schema (number | null | undefined)
      reorderLevel: values.reorderLevel !== undefined && values.reorderLevel !== null ? Number(values.reorderLevel) : null,
      defaultVatRatePercent: values.defaultVatRatePercent !== undefined && values.defaultVatRatePercent !== null ? Number(values.defaultVatRatePercent) : null,
      leadTimeDays: values.leadTimeDays !== undefined && values.leadTimeDays !== null ? Number(values.leadTimeDays) : null,
      // vendorSku and vendorItemName are string | null | undefined from schema, direct assign
    };

    createItemMutation.mutate(createPayload);
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Add New Inventory Item</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={handleSubmit} // Pass the new handleSubmit
            isLoading={createItemMutation.isPending} // Use the new mutation pending state
            formMode="full"
            // No initialData for add form
          />
        </CardContent>
      </Card>
    </div>
  );
} 