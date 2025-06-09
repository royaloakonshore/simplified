'use client';

import * as React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpsertBillOfMaterialSchema, UpsertBillOfMaterialInput, BillOfMaterialItemInput } from '@/lib/schemas/bom.schema';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { api } from "@/lib/trpc/react";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";
import { ComboboxResponsive } from '@/components/ui/combobox-responsive';
import { RawMaterialSelectionTable, RawMaterialRow } from '@/components/boms/RawMaterialSelectionTable';

// Type for inventory items passed as props (simplified for select)
export interface SelectableInventoryItem {
  id: string;
  name: string;
  sku?: string | null;
}

export interface BOMFormProps {
  initialData?: Partial<UpsertBillOfMaterialInput> & { id?: string; items?: BillOfMaterialItemInput[] }; // For edit mode
  manufacturedItems: SelectableInventoryItem[];
  rawMaterials: RawMaterialRow[];
  onSuccess?: (id: string) => void;
}

export function BOMForm({ initialData, manufacturedItems, rawMaterials, onSuccess }: BOMFormProps) {
  const router = useRouter();

  // State to manage selected BOM items from the table
  const [selectedBomItems, setSelectedBomItems] = React.useState<BillOfMaterialItemInput[]>(() => {
    return initialData?.items?.map(item => ({
      componentItemId: item.componentItemId,
      // Ensure quantity is a number for the form
      quantity: typeof item.quantity === 'object' && item.quantity !== null && 'toNumber' in item.quantity
                ? (item.quantity as { toNumber: () => number }).toNumber()
                : Number(item.quantity) || 1 // Default to 1 if undefined/null/0 after Number conversion
    })) || [];
  });
  
  const defaultFormValues: UpsertBillOfMaterialInput = {
    id: initialData?.id,
    name: initialData?.name || '',
    description: initialData?.description || '',
    manualLaborCost: initialData?.manualLaborCost || 0,
    manufacturedItemId: initialData?.manufacturedItemId || undefined, // Use undefined for optional combobox
    items: selectedBomItems, // Initialize form's items with state
  };

  const form = useForm<UpsertBillOfMaterialInput>({
    resolver: zodResolver(UpsertBillOfMaterialSchema),
    defaultValues: defaultFormValues,
  });

  // Watch for changes in selectedBomItems and update the form value for validation
  React.useEffect(() => {
    form.setValue('items', selectedBomItems, { shouldValidate: true, shouldDirty: true });
  }, [selectedBomItems, form]);

  const upsertBOMMutation = api.bom.upsert.useMutation({
    onSuccess: (data) => {
      toast.success(`BOM "${data.name}" ${initialData?.id ? 'updated' : 'created'} successfully!`);
      if (onSuccess) onSuccess(data.id);
      router.push('/boms'); 
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<UpsertBillOfMaterialInput> = (values) => {
    // 'values' from react-hook-form should already include the 'items' field
    // updated by the useEffect hook when selectedBomItems changes.
    // We directly use 'values' as it should be in the correct shape.
    console.log('Submitting BOM data:', values); // Debug log
    upsertBOMMutation.mutate(values);
  };
  
  const manufacturedItemOptions = manufacturedItems.map(item => ({ value: item.id, label: `${item.name} (${item.sku || 'N/A'})` }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BOM Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Standard Wooden Chair BOM" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detailed description of the BOM..." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="manufacturedItemId"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Manufactured Item (Optional)</FormLabel>
              <ComboboxResponsive
                options={manufacturedItemOptions}
                selectedValue={field.value || ''} // Handle undefined/null from optional schema
                onSelectedValueChange={field.onChange}
                placeholder="Select manufactured item..."
                searchPlaceholder="Search items..."
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <h3 className="text-lg font-medium mb-2">Component Items</h3>
          <RawMaterialSelectionTable
            allRawMaterials={rawMaterials}
            selectedItems={selectedBomItems}
            onSelectedItemsChange={setSelectedBomItems}
          />
          {/* Display validation error for items array if any */}
          {form.formState.errors.items?.message && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.items.message}</p>
          )}
           {/* Display validation error for individual items if type is array and has errors */}
          {Array.isArray(form.formState.errors.items) && form.formState.errors.items.map((error, index) => (
            error && (
                <p key={index} className="text-sm font-medium text-destructive">
                    Component #{index + 1}: {error.componentItemId?.message || error.quantity?.message}
                </p>
            )
          ))}
        </div>

        <FormField
          control={form.control}
          name="manualLaborCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manual Labor Cost</FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
              </FormControl>
              <FormDescription>
                Additional labor cost for assembling/manufacturing this BOM.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={upsertBOMMutation.isPending}>
          {upsertBOMMutation.isPending ? 'Saving...' : (initialData?.id ? 'Update BOM' : 'Create BOM')}
        </Button>
      </form>
    </Form>
  );
} 