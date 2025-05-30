'use client';

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type InventoryItem, ItemType as PrismaItemType, InventoryTransaction } from "@prisma/client";
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

// Type for what the form receives as initialData (item from API with processed Decimals)
export interface ProcessedInventoryItemApiData {
  id: string; // Keep ID for context (e.g. edit vs create)
  sku: string | null;
  name: string;
  description: string | null;
  unitOfMeasure: string | null;
  itemType: PrismaItemType; // Prisma enum
  inventoryCategoryId: string | null;
  // Stringified Decimal fields
  costPrice: string | null;
  salesPrice: string | null;
  minimumStockLevel: string | null;
  reorderLevel: string | null;
  quantityOnHand: string | null; // Current total quantity, for display or context
  // Parsed Decimal fields
  defaultVatRatePercent?: number | null;
  // New fields for initialData
  leadTimeDays?: number | null;
  vendorSku?: string | null;
  vendorItemName?: string | null;
  // Other InventoryItem fields if needed by the form for display (not for form submission values directly)
  qrIdentifier?: string | null;
  showInPricelist?: boolean | null;
  internalRemarks?: string | null;
  createdAt?: Date; // For display if needed
  updatedAt?: Date; // For display if needed
}

interface InventoryItemFormProps {
  initialData?: ProcessedInventoryItemApiData;
  onSubmitProp: (values: InventoryItemFormValues, mode: 'full' | 'scan-edit', initialStockOrAdjustment?: number) => void;
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
      ? (() => {
          const getNumericValue = (value: string | null | undefined, defaultValue: number = 0): number => {
            if (value === null || value === undefined) return defaultValue;
            const num = parseFloat(value);
            return isNaN(num) ? defaultValue : num;
          };
          const getOptionalNumericValue = (value: string | number | null | undefined, defaultValue?: number): number | undefined | null => {
            if (value === null || value === undefined) return defaultValue === undefined ? null : defaultValue;
            const num = parseFloat(String(value)); // Ensure value is string for parseFloat
            return isNaN(num) ? (defaultValue === undefined ? null : defaultValue) : num;
          };

          return {
            sku: initialData.sku ?? '',
            name: initialData.name ?? '',
            description: initialData.description ?? undefined,
            unitOfMeasure: initialData.unitOfMeasure ?? 'kpl',
            costPrice: getNumericValue(initialData.costPrice, 0), 
            salesPrice: getNumericValue(initialData.salesPrice, 0),
            itemType: initialData.itemType ?? PrismaItemType.RAW_MATERIAL,
            minimumStockLevel: getNumericValue(initialData.minimumStockLevel, 0),
            reorderLevel: getNumericValue(initialData.reorderLevel, 0),
            quantityOnHand: getNumericValue(initialData.quantityOnHand, 0),
            defaultVatRatePercent: initialData.defaultVatRatePercent ?? undefined,
            showInPricelist: initialData.showInPricelist ?? true,
            internalRemarks: initialData.internalRemarks ?? undefined,
            inventoryCategoryId: initialData.inventoryCategoryId ?? undefined,
            leadTimeDays: getOptionalNumericValue(initialData.leadTimeDays, undefined) as number | null | undefined,
            vendorSku: initialData.vendorSku ?? undefined,
            vendorItemName: initialData.vendorItemName ?? undefined,
          };
        })()
      : {
          sku: '',
          name: '',
          description: undefined,
          unitOfMeasure: 'kpl',
          costPrice: 0,
          salesPrice: 0,
          itemType: PrismaItemType.RAW_MATERIAL,
          minimumStockLevel: 0,
          reorderLevel: 0,
          quantityOnHand: 0,
          defaultVatRatePercent: undefined,
          showInPricelist: true,
          internalRemarks: undefined,
          inventoryCategoryId: undefined,
          leadTimeDays: undefined,
          vendorSku: undefined,
          vendorItemName: undefined,
        },
  });

  // Mutations for create/update are now handled by the parent page (EditInventoryItemPage, AddInventoryItemPage)
  // This form component will call onSubmitProp, which triggers those mutations.

  function onSubmit(values: InventoryItemFormValues) {
    onSubmitProp(values, formMode, values.quantityOnHand);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control as any}
                    name="quantityOnHand" 
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity on Hand*</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                        <FormDescription>
                            Current total stock quantity. Changes will create an adjustment transaction.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control as any}
                    name="costPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cost Price (€)*</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
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
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                    control={form.control as any}
                    name="itemType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Item Type*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger></FormControl>
                            <SelectContent>
                            <SelectItem value={PrismaItemType.RAW_MATERIAL}>Raw Material</SelectItem>
                            <SelectItem value={PrismaItemType.MANUFACTURED_GOOD}>Manufactured Good</SelectItem>
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
                        <FormControl><Input type="number" {...field} /></FormControl>
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
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormDescription>Optional reorder trigger level.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control as any}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (Days)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 7" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl>
                    <FormDescription>Estimated time to restock.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="vendorSku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor SKU</FormLabel>
                    <FormControl><Input placeholder="Vendor's SKU" {...field} /></FormControl>
                    <FormDescription>Supplier's stock keeping unit.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="vendorItemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Item Name</FormLabel>
                    <FormControl><Input placeholder="Vendor's Item Name" {...field} /></FormControl>
                    <FormDescription>Supplier's name for the item.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {initialData?.qrIdentifier && (
                 <div className="pt-4">
                    <FormLabel>QR Code</FormLabel>
                    <div className="mt-2 p-4 border rounded-md inline-block bg-white">
                        <ClientOnly fallback={<p>Loading QR Code...</p>}>
                            <QRCodeSVG value={initialData.qrIdentifier} size={128} />
                        </ClientOnly>
                    </div>
                    <FormDescription className="mt-2">Current QR code identifier: {initialData.qrIdentifier}</FormDescription>
                </div>
            )}
          </>
        )}

        {formMode === 'scan-edit' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Quick Update for: {initialData?.name} (SKU: {initialData?.sku})</h2>
            <FormField
                control={form.control as any}
                name="quantityOnHand"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>New Quantity on Hand</FormLabel>
                    <FormControl><Input 
                                    type="number" 
                                    step="1" 
                                    {...field} 
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    placeholder="Enter new total quantity" 
                                    /></FormControl>
                    <FormDescription>Enter the new total stock quantity. An adjustment transaction will be created.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            <FormField
              control={form.control as any}
              name="costPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update Cost Price (€) (Optional)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>If cost price has changed, update it here.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : (initialData?.id && formMode === 'full' ? "Save Changes" : (formMode === 'scan-edit' ? "Update Stock" : "Create Item"))}
            </Button>
        </div>
      </form>
    </Form>
  );
} 