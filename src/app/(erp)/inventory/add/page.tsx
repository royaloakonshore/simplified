"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { type InventoryItemFormValues, type CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import type { InventoryCategory } from "@prisma/client"; // Import the type
// import type { TRPCClientErrorLike } from "@trpc/react-query"; // Not directly used
// import type { AppRouter } from "@/lib/api/root"; // Not directly used

export default function AddInventoryItemPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // Fetch inventory categories
  const { data: categoriesData, isLoading: isLoadingCategories, error: categoriesError } = api.inventoryCategory.list.useQuery();

  // Use the new 'create' mutation from the inventory router
  const createItemMutation = api.inventory.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Inventory item "${data.name}" created successfully!`);
      utils.inventory.list.invalidate();
      utils.inventoryCategory.list.invalidate(); // Invalidate categories if new item might affect them (e.g. usage counts)
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

  if (isLoadingCategories) {
    return (
      <div className="w-full">
        <Card>
          <CardHeader><CardTitle>Add New Inventory Item</CardTitle></CardHeader>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-20 w-full mb-4" />
            <Skeleton className="h-10 w-1/3 mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div className="w-full">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Categories</AlertTitle>
          <AlertDescription>{categoriesError.message || "Could not load inventory categories. Please try again."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const categoryOptions = categoriesData?.map((cat: InventoryCategory) => ({ value: cat.id, label: cat.name })) || [];

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle>Add New Inventory Item</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <InventoryItemForm 
            onSubmitProp={handleSubmit} 
            isLoading={createItemMutation.isPending} 
            formMode="full"
            inventoryCategories={categoryOptions}
            // No initialData for add form
          />
        </CardContent>
      </Card>
    </div>
  );
} 