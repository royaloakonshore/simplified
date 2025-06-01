'use client';

import { useForm, SubmitHandler, useFieldArray } from 'react-hook-form';
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
import { toast } from 'react-toastify';
import { ComboboxResponsive } from '@/components/ui/combobox-responsive';
import { PlusCircle, Trash2 } from 'lucide-react';

// Type for inventory items passed as props (simplified for select)
interface SelectableInventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  // Add other fields if needed for display in combobox
}

export interface BOMFormProps {
  initialData?: Partial<UpsertBillOfMaterialInput> & { id?: string; items?: BillOfMaterialItemInput[] }; // For edit mode
  manufacturedItems: SelectableInventoryItem[];
  rawMaterials: SelectableInventoryItem[];
  companyId: string;
}

// Default values for a new BOM item
const defaultBomItemValue: BillOfMaterialItemInput = {
  componentItemId: '',
  quantity: 1,
};

export function BOMForm({ initialData, manufacturedItems, rawMaterials, companyId }: BOMFormProps) {
  const router = useRouter();
  
  const defaultFormValues: UpsertBillOfMaterialInput = {
    id: initialData?.id,
    name: initialData?.name || '',
    description: initialData?.description || '',
    manualLaborCost: initialData?.manualLaborCost || 0,
    manufacturedItemId: initialData?.manufacturedItemId || '',
    items: initialData?.items && initialData.items.length > 0 
           ? initialData.items.map(item => ({ 
               ...item, 
               // Ensure quantity is a number for the form, Prisma Decimal might be an object
               quantity: typeof item.quantity === 'object' && item.quantity !== null && 'toNumber' in item.quantity 
                         ? (item.quantity as any).toNumber() 
                         : Number(item.quantity) 
             })) 
           : [defaultBomItemValue],
    companyId: initialData?.companyId || companyId,
  };

  const form = useForm<UpsertBillOfMaterialInput>({
    resolver: zodResolver(UpsertBillOfMaterialSchema),
    defaultValues: defaultFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const upsertBOMMutation = api.bom.upsert.useMutation({
    onSuccess: (data) => {
      toast.success(`BOM "${data.name}" ${initialData?.id ? 'updated' : 'created'} successfully!`);
      router.push('/boms'); // Redirect to BOM list page
      // Optionally, redirect to the detail page: router.push(`/boms/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<UpsertBillOfMaterialInput> = (values) => {
    // Ensure companyId is part of the submission if not already handled by schema default/context
    const submissionValues = { ...values, companyId }; 
    upsertBOMMutation.mutate(submissionValues);
  };
  
  const manufacturedItemOptions = manufacturedItems.map(item => ({ value: item.id, label: `${item.name} (${item.sku || 'N/A'})` }));
  const rawMaterialOptions = rawMaterials.map(item => ({ value: item.id, label: `${item.name} (${item.sku || 'N/A'})` }));

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
                <Textarea placeholder="Detailed description of the BOM..." {...field} value={field.value ?? ''} />
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
              <FormLabel>Manufactured Item</FormLabel>
              <ComboboxResponsive
                options={manufacturedItemOptions}
                selectedValue={field.value}
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
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-4 p-4 mb-2 border rounded-md">
              <FormField
                control={form.control}
                name={`items.${index}.componentItemId`}
                render={({ field: itemField }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Component Item #{index + 1}</FormLabel>
                    <ComboboxResponsive
                      options={rawMaterialOptions}
                      selectedValue={itemField.value}
                      onSelectedValueChange={itemField.onChange}
                      placeholder="Select raw material..."
                      searchPlaceholder="Search materials..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field: itemField }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1" {...itemField} onChange={e => itemField.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(defaultBomItemValue)}
            className="mt-2"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Component
          </Button>
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