'use client';

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InventoryItem, MaterialType as PrismaMaterialType } from "@prisma/client";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from 'qrcode.react';
import ClientOnly from "@/components/ClientOnly";

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
import { inventoryItemBaseSchema, type InventoryItemFormValues } from "@/lib/schemas/inventory.schema";

interface InventoryItemFormProps {
  initialData?: InventoryItem & { qrIdentifier?: string | null };
  onSubmitProp: (values: InventoryItemFormValues, mode: 'full' | 'scan-edit', quantityAdjustment?: number) => void;
  isLoading?: boolean;
  formMode?: 'full' | 'scan-edit';
}

export function InventoryItemForm({
  initialData,
  onSubmitProp,
  isLoading,
  formMode = 'full',
}: InventoryItemFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const form = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemBaseSchema as any),
    defaultValues: initialData
      ? {
          sku: initialData.sku,
          name: initialData.name,
          description: initialData.description ?? undefined,
          unitOfMeasure: initialData.unitOfMeasure ?? 'kpl',
          costPrice: initialData.costPrice !== null ? parseFloat(initialData.costPrice.toString()) : 0,
          salesPrice: initialData.salesPrice !== null ? parseFloat(initialData.salesPrice.toString()) : 0,
          materialType: initialData.materialType ?? PrismaMaterialType.raw_material,
          minimumStockLevel: initialData.minimumStockLevel !== null ? parseFloat(initialData.minimumStockLevel.toString()) : 0,
          reorderLevel: initialData.reorderLevel !== null ? parseFloat(initialData.reorderLevel.toString()) : 0,
        }
      : {
          sku: '',
          name: '',
          description: undefined,
          unitOfMeasure: 'kpl',
          costPrice: 0,
          salesPrice: 0,
          materialType: PrismaMaterialType.raw_material,
          minimumStockLevel: 0,
          reorderLevel: 0,
        },
  });

  const [quantityAdjustment, setQuantityAdjustment] = React.useState<number | undefined>(undefined);

  const createItem = api.inventory.create.useMutation({
    onSuccess: () => {
      toast.success('Inventory item created successfully!');
      utils.inventory.list.invalidate();
      router.push('/inventory');
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

  function onSubmit(values: InventoryItemFormValues) {
    onSubmitProp(values, formMode, formMode === 'scan-edit' ? quantityAdjustment : undefined);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {formMode === 'full' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control as any}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU*</FormLabel>
                    <FormControl><Input placeholder="RAW-MAT-001" {...field} /></FormControl>
                    <FormDescription>Stock Keeping Unit (must be unique).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name*</FormLabel>
                    <FormControl><Input placeholder="Item Name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control as any}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional item description..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                    control={form.control as any}
                    name="unitOfMeasure"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit of Measure*</FormLabel>
                        <FormControl><Input placeholder="kpl, ltr, kg, m" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control as any}
                    name="costPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cost Price (€)*</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control as any}
                    name="salesPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Sales Price (€)*</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                    control={form.control as any}
                    name="materialType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Material Type*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select material type" /></SelectTrigger></FormControl>
                            <SelectContent>
                            <SelectItem value={PrismaMaterialType.raw_material}>Raw Material</SelectItem>
                            <SelectItem value={PrismaMaterialType.manufactured}>Manufactured</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control as any}
                    name="minimumStockLevel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Minimum Stock Level</FormLabel>
                        <FormControl><Input type="number" step="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormDescription>Optional warning level.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control as any}
                    name="reorderLevel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reorder Level</FormLabel>
                        <FormControl><Input type="number" step="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormDescription>Optional reorder trigger level.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
          </>
        )}

        {formMode === 'scan-edit' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Quick Update for: {initialData?.name} (SKU: {initialData?.sku})</h2>
            <FormItem>
              <FormLabel>Quantity Adjustment</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="1" 
                  placeholder="e.g., 10 or -5" 
                  value={quantityAdjustment === undefined ? '' : quantityAdjustment}
                  onChange={e => setQuantityAdjustment(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormDescription>Enter positive for stock in, negative for stock out. This will create an adjustment transaction.</FormDescription>
              <FormMessage /> 
            </FormItem>
            
            <FormField
              control={form.control as any}
              name="costPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update Cost Price (€) (Optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                  <FormDescription>If you are recording a purchase, you can update the cost price.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
          {isLoading 
            ? (formMode === 'scan-edit' ? "Processing..." : (initialData ? "Saving..." : "Creating...")) 
            : (formMode === 'scan-edit' ? "Adjust Stock & Update Price" : (initialData ? "Save Changes" : "Create Item"))}
        </Button>
      </form>

      {initialData && initialData.qrIdentifier && formMode === 'full' && (
        <div className="mt-10 pt-6 border-t">
          <h3 className="text-lg font-semibold mb-3">Item QR Code</h3>
          <div className="flex flex-col items-center md:items-start">
            <ClientOnly>
              <QRCodeSVG value={initialData.qrIdentifier} size={128} bgColor={"#ffffff"} fgColor={"#000000"} level={"Q"} />
            </ClientOnly>
            <p className="text-sm text-muted-foreground mt-2">Scan for item details/editing.</p>
          </div>
        </div>
      )}
    </Form>
  );
} 