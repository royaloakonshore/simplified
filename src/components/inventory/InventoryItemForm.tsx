'use client';

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InventoryItem, MaterialType } from "@prisma/client";
import { z } from "zod";
import { useRouter } from "next/navigation";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'react-toastify';
import { api } from "@/lib/trpc/react";
import { inventoryItemBaseSchema } from "@/lib/schemas/inventory.schema";

// Define the form schema type
// Keep this type definition for potential future use or clarity, though it won't directly type useForm anymore.
type InventoryItemFormData = z.infer<typeof inventoryItemBaseSchema>;

interface InventoryItemFormProps {
  initialData?: InventoryItem;
}

export function InventoryItemForm({ initialData }: InventoryItemFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Let the type be inferred from the resolver
  const form = useForm({
    resolver: zodResolver(inventoryItemBaseSchema),
    defaultValues: initialData
      ? {
          // Explicitly map fields to ensure correct types
          sku: initialData.sku,
          name: initialData.name,
          description: initialData.description ?? undefined,
          unitOfMeasure: initialData.unitOfMeasure,
          costPrice: initialData.costPrice?.toNumber() ?? 0,
          salesPrice: initialData.salesPrice?.toNumber() ?? 0,
          materialType: initialData.materialType,
          minimumStockLevel: initialData.minimumStockLevel?.toNumber() ?? 0,
          reorderLevel: initialData.reorderLevel?.toNumber() ?? 0,
          // Note: createdAt and updatedAt are usually handled by the DB
        }
      : {
          sku: '',
          name: '',
          description: undefined,
          unitOfMeasure: 'kpl',
          costPrice: 0,
          salesPrice: 0,
          materialType: MaterialType.raw_material,
          minimumStockLevel: 0,
          reorderLevel: 0,
        },
  });

  const createItem = api.inventory.create.useMutation({
    onSuccess: () => {
      toast.success('Inventory item created successfully!');
      utils.inventory.list.invalidate(); // Invalidate list query
      router.push('/inventory'); // Redirect to inventory list
    },
    onError: (error) => {
      toast.error(`Error creating item: ${error.message}`);
    },
  });

  const updateItem = api.inventory.update.useMutation({
    onSuccess: () => {
      toast.success('Inventory item updated successfully!');
      utils.inventory.list.invalidate();
      if (initialData) {
          utils.inventory.getById.invalidate({ id: initialData.id });
      }
      router.push('/inventory');
    },
    onError: (error) => {
      toast.error(`Error updating item: ${error.message}`);
    },
  });

  // Let handleSubmit infer the type for 'values'
  function onSubmit(values: z.infer<typeof inventoryItemBaseSchema>) { // Explicitly type values based on schema inference
    if (initialData) {
      updateItem.mutate({ ...values, id: initialData.id });
    } else {
      createItem.mutate(values);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU*</FormLabel>
                <FormControl>
                  <Input placeholder="RAW-MAT-001" {...field} />
                </FormControl>
                <FormDescription>Stock Keeping Unit (must be unique).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Item Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional item description..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="unitOfMeasure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit of Measure*</FormLabel>
                <FormControl>
                  <Input placeholder="kpl, ltr, kg, m" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="costPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost Price (€)*</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salesPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sales Price (€)*</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <FormField
              control={form.control}
              name="materialType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material Type*</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select material type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={MaterialType.raw_material}>Raw Material</SelectItem>
                      <SelectItem value={MaterialType.manufactured}>Manufactured</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="minimumStockLevel"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Minimum Stock Level</FormLabel>
                    <FormControl>
                    <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormDescription>Optional warning level.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                    <Input type="number" step="1" {...field} />
                    </FormControl>
                     <FormDescription>Optional reorder trigger level.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
          {initialData ? 'Update Item' : 'Create Item'}
        </Button>
      </form>
    </Form>
  );
} 