'use client';

import * as React from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemType as PrismaItemType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from 'qrcode.react';
import ClientOnly from "@/components/ClientOnly";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { parseNordicNumber, formatNordicNumber, isValidNordicNumber } from '@/lib/utils/nordic-numbers';
import { inventoryItemBaseSchema, type InventoryItemFormValues } from "@/lib/schemas/inventory.schema";
import { CreateCategoryDialog } from "./CreateCategoryDialog";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Type for what the form receives as initialData.
// This is data that has been processed from an API call to be ready for the form.
export type ProcessedInventoryItemApiData = {
  id?: string;
  qrIdentifier?: string;
  createdAt?: Date;
  updatedAt?: Date;
  sku?: string;
  name?: string;
  description?: string | null;
  unitOfMeasure?: string;
  itemType?: PrismaItemType;
  inventoryCategoryId?: string | null;
  showInPricelist?: boolean;
  internalRemarks?: string | null;
  variant?: string | null;
  // Fields that might come in as strings or other types from an API
  costPrice?: string | number | null;
  salesPrice?: string | number | null;
  minimumStockLevel?: string | number | null;
  reorderLevel?: string | number | null;
  quantityOnHand?: string | number | null;
  leadTimeDays?: string | number | null;
  defaultVatRatePercent?: string | number | null;
  vendorSku?: string | null;
  vendorItemName?: string | null;
  dimensions?: string | null;
  weight?: string | number | null;
};

interface InventoryItemFormProps {
  initialData?: ProcessedInventoryItemApiData;
  onSubmitProp: (
    values: InventoryItemFormValues,
    mode: 'full' | 'scan-edit',
    initialStockOrAdjustment?: number
  ) => void;
  isLoading?: boolean;
  formMode?: 'full' | 'scan-edit';
  inventoryCategories: Array<{ value: string; label: string }>;
}

// A helper function to map API data to form values, ensuring type consistency.
const mapApiDataToFormValues = (
  item?: ProcessedInventoryItemApiData
): InventoryItemFormValues => {
  const parseNumber = (val: string | number | null | undefined): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return parseFloat(val);
    return 0;
  };

  const parseNullableNumber = (val: string | number | null | undefined): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return parseFloat(val);
    return null;
  };

  if (item) {
    // Editing an existing item
    return {
      sku: item.sku ?? '',
      name: item.name ?? '',
      description: item.description ?? undefined,
      unitOfMeasure: item.unitOfMeasure ?? 'kpl',
      itemType: item.itemType ?? PrismaItemType.RAW_MATERIAL,
      inventoryCategoryId: item.inventoryCategoryId ?? undefined,
      costPrice: parseNumber(item.costPrice),
      salesPrice: parseNumber(item.salesPrice),
      minimumStockLevel: parseNumber(item.minimumStockLevel),
      reorderLevel: parseNullableNumber(item.reorderLevel),
      quantityOnHand: parseNumber(item.quantityOnHand),
      defaultVatRatePercent: parseNullableNumber(item.defaultVatRatePercent),
      leadTimeDays: parseNullableNumber(item.leadTimeDays),
      vendorSku: item.vendorSku ?? null,
      vendorItemName: item.vendorItemName ?? null,
      variant: item.variant ?? null,
      dimensions: item.dimensions ?? null,
      weight: parseNullableNumber(item.weight),
      showInPricelist: item.showInPricelist ?? true,
      internalRemarks: item.internalRemarks ?? undefined,
    } satisfies InventoryItemFormValues;
  }

  // Creating a new item
  return {
    sku: '',
    name: '',
    description: undefined,
    unitOfMeasure: 'kpl',
    costPrice: 0,
    salesPrice: 0,
    itemType: PrismaItemType.RAW_MATERIAL,
    minimumStockLevel: 0,
    reorderLevel: null,
    quantityOnHand: 0,
    showInPricelist: true,
    inventoryCategoryId: undefined,
    internalRemarks: undefined,
    defaultVatRatePercent: null,
    vendorSku: null,
    vendorItemName: null,
    leadTimeDays: null,
    variant: null,
    dimensions: null,
    weight: null,
  } satisfies InventoryItemFormValues;
};

export function InventoryItemForm({
  initialData,
  onSubmitProp,
  isLoading,
  formMode = 'full',
  inventoryCategories,
}: InventoryItemFormProps) {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(inventoryItemBaseSchema),
    defaultValues: mapApiDataToFormValues(initialData),
  }) as UseFormReturn<InventoryItemFormValues>;
  
  const watchedItemType = form.watch("itemType");
  
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
                control={form.control}
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
                control={form.control}
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
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional item description..." {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Physical Attributes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="dimensions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dimensions</FormLabel>
                    <FormControl><Input placeholder="e.g., 10cm x 5cm x 3cm" {...field} value={field.value ?? ''} /></FormControl>
                    <FormDescription>Physical dimensions (free text)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input 
                        type="text"
                        value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            field.onChange(null);
                            return;
                          }
                          
                          if (isValidNordicNumber(value)) {
                            const numericValue = parseNordicNumber(value);
                            if (!isNaN(numericValue)) {
                              field.onChange(numericValue);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value !== '' && !isValidNordicNumber(value)) {
                            field.onChange(null);
                          }
                          field.onBlur();
                        }}
                        placeholder="e.g. 0,5"
                      />
                    </FormControl>
                    <FormDescription>Weight in kilograms</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="quantityOnHand" 
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity on Hand*</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                            value={field.value?.toString() ?? '0'}
                          />
                        </FormControl>
                        <FormDescription>
                            Current total stock quantity. Changes will create an adjustment transaction.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
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
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cost Price (€)*</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                            value={field.value?.toString() ?? '0'}
                          />
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
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                    control={form.control}
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
                    control={form.control}
                    name="variant"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Variant (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g., Blue, XL, Heavy Duty" {...field} value={field.value ?? ''} /></FormControl>
                        <FormDescription>Specify a variant for this item if applicable.</FormDescription>
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
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormDescription>Optional warning level.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                    control={form.control}
                    name="reorderLevel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reorder Level</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        <FormDescription>Minimum stock level before reordering.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="inventoryCategoryId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Inventory Category</FormLabel>
                        <div className="flex items-center gap-2">
                            <Select onValueChange={field.onChange} value={field.value ?? undefined} defaultValue={field.value ?? undefined}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {inventoryCategories.map(category => (
                                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <CreateCategoryDialog
                                onSuccess={() => {
                                    // The parent component should refresh the categories
                                }}
                                trigger={
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        disabled={isLoading}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Add
                                    </Button>
                                }
                            />
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="defaultVatRatePercent"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Default VAT Rate (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text"
                            value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 1) : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                field.onChange(null);
                                return;
                              }
                              
                              if (isValidNordicNumber(value)) {
                                const numericValue = parseNordicNumber(value);
                                if (!isNaN(numericValue)) {
                                  field.onChange(numericValue);
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value !== '' && !isValidNordicNumber(value)) {
                                field.onChange(null);
                              }
                              field.onBlur();
                            }}
                            placeholder="e.g. 24,0"
                          />
                        </FormControl>
                        <FormDescription>Default VAT rate for this item.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
                control={form.control}
                name="showInPricelist"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">Show in Pricelist</FormLabel>
                            <FormDescription>
                                Should this item be visible in generated pricelists or catalogues?
                            </FormDescription>
                        </div>
                        <FormControl>
                            <input type="checkbox" checked={field.value} onChange={field.onChange} className="form-checkbox h-5 w-5 text-blue-600"/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="internalRemarks"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Internal Remarks</FormLabel>
                    <FormControl><Textarea placeholder="Internal notes about this item..." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            {watchedItemType !== PrismaItemType.MANUFACTURED_GOOD && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Time (Days)</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g. 7" {...field} value={field.value ?? ''} /></FormControl>
                      <FormDescription>Estimated time to restock.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendorSku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor SKU</FormLabel>
                      <FormControl><Input placeholder="Vendor&apos;s SKU for this item" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vendorItemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Item Name</FormLabel>
                      <FormControl><Input placeholder="Vendor&apos;s name for this item" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
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
                control={form.control}
                name="quantityOnHand"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>New Quantity on Hand</FormLabel>
                    <FormControl><Input 
                                    type="number" 
                                    step="1" 
                                    {...field} 
                                    placeholder="Enter new total quantity" 
                                    /></FormControl>
                    <FormDescription>Enter the new total stock quantity. An adjustment transaction will be created.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            <FormField
              control={form.control}
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
      
      {/* Create Category Dialog */}
      {/* This dialog is now managed by CreateCategoryDialog */}
    </Form>
  );
} 