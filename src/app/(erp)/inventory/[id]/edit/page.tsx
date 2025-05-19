"use client";

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import type { UpdateInventoryItemInput } from '@/lib/schemas/inventory.schema';
import { inventoryItemBaseSchema } from '@/lib/schemas/inventory.schema'; // Import base schema
import { z } from 'zod';

export default function EditInventoryItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;

  const { data: item, isLoading, error } = api.inventory.getById.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  const updateMutation = api.inventory.update.useMutation({
    onSuccess: () => {
      toast.success('Inventory item updated successfully!');
      router.push('/inventory');
      // Optionally, invalidate relevant queries
      // utils.inventory.list.invalidate(); 
      // utils.inventory.getById.invalidate({ id: itemId });
    },
    onError: (err) => {
      toast.error(`Failed to update item: ${err.message}`);
    },
  });

  const handleSubmit = (values: z.infer<typeof inventoryItemBaseSchema>) => {
    if (!itemId) return; // Should not happen if item is loaded
    updateMutation.mutate({ ...values, id: itemId });
  };

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error loading inventory item</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!item) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Inventory Item Not Found</AlertTitle>
        <AlertDescription>
          The inventory item you are trying to edit could not be found.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Do NOT transform Prisma Decimal fields to numbers for the form here.
  // The InventoryItemForm itself handles the conversion from Decimal to number for its defaultValues.
  const initialDataForForm = {
    ...item,
    // costPrice: item.costPrice.toNumber(), // Removed conversion
    // salesPrice: item.salesPrice.toNumber(), // Removed conversion
    // minimumStockLevel: item.minimumStockLevel.toNumber(), // Removed conversion
    // reorderLevel: item.reorderLevel.toNumber(), // Removed conversion
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Inventory Item: {item.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <InventoryItemForm 
          onSubmit={handleSubmit} 
          initialData={item} // Pass the original item data with Decimals
          isLoading={updateMutation.isPending}
        />
      </CardContent>
    </Card>
  );
} 