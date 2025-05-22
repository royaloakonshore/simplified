"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { InventoryItemForm } from '@/components/inventory/InventoryItemForm';
import { toast } from 'react-toastify';
import { inventoryItemBaseSchema } from '@/lib/schemas/inventory.schema';
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
      <h1 className="text-2xl font-bold mb-6">Edit Inventory Item: {item.name}</h1>
      <Card className="max-w-2xl mx-auto">
        <CardContent>
          <InventoryItemForm 
            onSubmit={handleSubmit} 
            initialData={item}
            isLoading={updateMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
} 