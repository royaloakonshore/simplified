"use client";

import { useRouter } from 'next/navigation';
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { api } from "@/lib/trpc/react";
import { toast } from 'react-toastify';
import type { CreateInventoryItemInput } from "@/lib/schemas/inventory.schema";
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

  const handleSubmit = (values: CreateInventoryItemInput) => {
    createMutation.mutate(values);
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8 max-w-2xl mx-auto">
      {/* Optional: Consistent Heading and Description for add pages */}
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Add New Inventory Item</h1>
            <p className="text-sm text-muted-foreground">
                Fill in the details to create a new inventory item.
            </p>
        </div>
      </div>
      {/* <Separator className="my-6" /> */}
      <div className="border-b my-6" /> {/* Simple separator */}

      <InventoryItemForm 
        onSubmit={handleSubmit} 
        isLoading={createMutation.isPending} 
      />
    </div>
  );
} 