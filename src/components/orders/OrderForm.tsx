"use client";

// Original imports might be needed later, keep them commented for now
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, type SubmitHandler, FormProvider, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Order, type OrderItem, OrderStatus, type Customer, type InventoryItem } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import {
  createOrderSchema,
  updateOrderSchema,
  CreateOrderInput,
  UpdateOrderInput,
} from "@/lib/schemas/order.schema";
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { z } from 'zod';

// Define form value types from Zod schemas
type CreateFormValues = z.infer<typeof createOrderSchema>;
type UpdateFormValues = z.infer<typeof updateOrderSchema>;

// Type for the form instances
type CreateFormInstance = UseFormReturn<CreateFormValues>;
type UpdateFormInstance = UseFormReturn<UpdateFormValues>;

type OrderFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure'>[];
  order?: Order & { items: (OrderItem & { item: InventoryItem })[] };
  isEditMode?: boolean;
};

// Removed OrderFormContent abstraction

export default function OrderForm({ customers, inventoryItems, order, isEditMode = false }: OrderFormProps) {
  const router = useRouter();

  // --- Create Form Setup ---
  const createForm = useForm<CreateFormValues>({
    // Cast resolver to any to bypass schema conflict temporarily
    resolver: zodResolver(createOrderSchema) as any, 
    defaultValues: {
      customerId: '',
      notes: '',
      status: OrderStatus.draft,
      items: [{ itemId: '', quantity: 1, unitPrice: 0 }],
    },
  });
  const { fields: createFields, append: createAppend, remove: createRemove } = useFieldArray({
    control: createForm.control,
    name: "items",
    keyName: "key",
  });

  // --- Update Form Setup ---
  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateOrderSchema), // Keep resolver typed here
    defaultValues: undefined,
  });
   const { fields: updateFields, append: updateAppend, remove: updateRemove } = useFieldArray({
    control: updateForm.control,
    name: "items",
    keyName: "key",
  });

  // Effect to set/reset Update form default values
  useEffect(() => {
    if (isEditMode && order) {
        updateForm.reset({
            id: order.id,
            customerId: order.customerId,
            notes: order.notes ?? '',
            items: order.items.map(item => ({
                id: item.id,
                itemId: item.itemId,
                quantity: item.quantity.toNumber(),
                unitPrice: item.unitPrice.toNumber(),
            })),
        });
    } else if (!isEditMode) {
        // Reset create form when switching back to create mode (or initial load)
        createForm.reset({
            customerId: '',
            notes: '',
            status: OrderStatus.draft,
            items: [{ itemId: '', quantity: 1, unitPrice: 0 }],
        });
    }
  }, [order, isEditMode, updateForm]);

  // --- Mutations ---
  const createOrderMutation = api.order.create.useMutation({
    onSuccess: () => {
      toast.success("Order created successfully!");
      router.push('/orders');
      router.refresh();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      console.error("Create Order Error:", error);
      toast.error(`Failed to create order: ${error.message}`);
    },
  });

  const updateOrderMutation = api.order.update.useMutation({
    onSuccess: () => {
      toast.success("Order updated successfully!");
      router.push('/orders');
      router.refresh();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      console.error("Update Order Error:", error);
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  // --- Submit Handlers ---
  const handleCreateSubmit: SubmitHandler<CreateFormValues> = (data) => {
    console.log("Create Data:", data);
    const processedData: CreateOrderInput = {
      ...data,
      items: (data.items || []).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
    };
    createOrderMutation.mutate(processedData);
  };

  const handleUpdateSubmit: SubmitHandler<UpdateFormValues> = (data) => {
    console.log("Update Data (Raw from form):");
    console.dir(data, { depth: null });

    if (!data.id) return toast.error("Cannot update order without an ID.");

    // Ensure the data conforms to UpdateOrderInput for the mutation
    // updateOrderSchema makes status optional, but our API prevents updating it here.
    // We should remove it if present, along with potentially other fields not meant for update.
    const processedData = { ...data };

    // Remove status if it exists in the form data (it shouldn't be updated here)
    if ('status' in processedData) {
      delete (processedData as Partial<UpdateFormValues>).status;
    }

    // Optionally remove other fields if API prevents their update
    // delete processedData.customerId; // If customerId cannot be changed

    // Ensure item quantities/prices are numbers (though zodResolver should handle this)
    if (processedData.items) {
        processedData.items = processedData.items.map(item => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
        }));
    }
    
    console.log("Update Data (Processed for mutation):");
    console.dir(processedData, { depth: null });

    // Assert the type for the mutation - needs id, and potentially partial other fields
    updateOrderMutation.mutate(processedData as UpdateOrderInput);
  };

  // --- Shared Helper/Event Logic (adjust based on active form) ---
  const handleItemChange = (index: number, itemId: string, formInstance: CreateFormInstance | UpdateFormInstance) => {
    const selectedItem = inventoryItems.find(invItem => invItem.id === itemId);
    if (selectedItem) {
      formInstance.setValue(`items.${index}.itemId`, selectedItem.id, { shouldValidate: true });
      formInstance.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice.toNumber(), { shouldValidate: true });
    }
  };

  const calculateTotal = (formInstance: CreateFormInstance | UpdateFormInstance) => {
    const items = formInstance.watch("items");
    return Array.isArray(items) ? items.reduce((total: number, item: any) => {
      const quantity = Number(item?.quantity) || 0;
      const price = Number(item?.unitPrice) || 0;
      return total + quantity * price;
    }, 0) : 0;
  };

  // --- Conditional Rendering ---
  if (isEditMode) {
    // --- EDIT MODE RENDER ---
    if (!order && !updateForm.formState.isDirty) {
        return <div>Loading order data...</div>;
    }

    return (
      <FormProvider {...updateForm}>
        <form onSubmit={updateForm.handleSubmit(handleUpdateSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Edit Order</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Selection (Bound to updateForm) */}
              <FormField
                control={updateForm.control}
                name={"customerId"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={true}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Items Table (Bound to updateForm) */}
              <div className="space-y-2">
                <FormLabel>Order Items</FormLabel>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Line Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {updateFields.map((field, index) => (
                      <TableRow key={field.key}>
                        <TableCell>
                           <FormField
                              control={updateForm.control}
                              name={`items.${index}.itemId`}
                              render={({ field: itemField }) => (
                                <FormItem>
                                  <Select onValueChange={(v) => handleItemChange(index, v, updateForm)} defaultValue={itemField.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
                                    <SelectContent>{inventoryItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                             />
                        </TableCell>
                        <TableCell>
                           <FormField
                              control={updateForm.control}
                              name={`items.${index}.quantity`}
                              render={({ field: qtyField }) => (
                                <FormItem>
                                  <FormControl><Input type="number" {...qtyField} onChange={e => qtyField.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                             />
                        </TableCell>
                         <TableCell>
                           <FormField
                              control={updateForm.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field: priceField }) => (
                                <FormItem>
                                  <FormControl><Input type="number" step="0.01" {...priceField} onChange={e => priceField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl>
                                  <FormDescription>{formatCurrency(Number(priceField.value) || 0)}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                             />
                        </TableCell>
                         <TableCell>{formatCurrency((Number(updateForm.watch(`items.${index}.quantity`)) || 0) * (Number(updateForm.watch(`items.${index}.unitPrice`)) || 0))}</TableCell>
                        <TableCell><Button type="button" variant="destructive" size="sm" onClick={() => updateRemove(index)} disabled={updateFields.length <= 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" onClick={() => updateAppend({ itemId: '', quantity: 1, unitPrice: 0 })} >Add Item</Button>
                 {updateForm.formState.errors.items && typeof updateForm.formState.errors.items === 'object' && 'message' in updateForm.formState.errors.items && (
                    <p className="text-sm font-medium text-destructive">{updateForm.formState.errors.items.message as string}</p>
                 )}
              </div>
              {/* Notes (Bound to updateForm) */}
              <FormField
                control={updateForm.control}
                name={"notes"}
                render={({ field }) => (
                   <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Optional notes..." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total: {formatCurrency(calculateTotal(updateForm))}</span>
              <Button type="submit" disabled={updateOrderMutation.isPending}>{updateOrderMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
          </Card>
        </form>
      </FormProvider>
    );

  } else {
    // --- CREATE MODE RENDER ---
     return (
      <FormProvider {...createForm}>
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-8">
           <Card>
             <CardHeader><CardTitle>Create New Order</CardTitle></CardHeader>
             <CardContent className="space-y-6">
               {/* Customer Selection (Bound to createForm) */}
               <FormField
                 control={createForm.control}
                 name={"customerId"}
                 render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} >
                         <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
                         <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                 )}
               />
               {/* Items Table (Bound to createForm) */}
               <div className="space-y-2">
                 <FormLabel>Order Items</FormLabel>
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="w-[40%]">Item</TableHead>
                       <TableHead>Quantity</TableHead>
                       <TableHead>Unit Price</TableHead>
                       <TableHead>Line Total</TableHead>
                       <TableHead>Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {createFields.map((field, index) => (
                       <TableRow key={field.key}>
                         <TableCell>
                           <FormField
                              control={createForm.control}
                              name={`items.${index}.itemId`}
                              render={({ field: itemField }) => (
                                 <FormItem>
                                   <Select onValueChange={(v) => handleItemChange(index, v, createForm)} defaultValue={itemField.value}>
                                     <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
                                     <SelectContent>{inventoryItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                   </Select>
                                   <FormMessage />
                                 </FormItem>
                              )}
                             />
                         </TableCell>
                         <TableCell>
                            <FormField
                              control={createForm.control}
                              name={`items.${index}.quantity`}
                              render={({ field: qtyField }) => (
                                 <FormItem>
                                   <FormControl><Input type="number" {...qtyField} onChange={e => qtyField.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} /></FormControl>
                                   <FormMessage />
                                 </FormItem>
                              )}
                             />
                         </TableCell>
                          <TableCell>
                             <FormField
                              control={createForm.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field: priceField }) => (
                                 <FormItem>
                                   <FormControl><Input type="number" step="0.01" {...priceField} onChange={e => priceField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl>
                                   <FormDescription>{formatCurrency(Number(priceField.value) || 0)}</FormDescription>
                                   <FormMessage />
                                 </FormItem>
                              )}
                             />
                         </TableCell>
                         <TableCell>{formatCurrency((Number(createForm.watch(`items.${index}.quantity`)) || 0) * (Number(createForm.watch(`items.${index}.unitPrice`)) || 0))}</TableCell>
                         <TableCell><Button type="button" variant="destructive" size="sm" onClick={() => createRemove(index)} disabled={createFields.length <= 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
                 <Button type="button" variant="outline" size="sm" onClick={() => createAppend({ itemId: '', quantity: 1, unitPrice: 0 })} >Add Item</Button>
                  {createForm.formState.errors.items && typeof createForm.formState.errors.items === 'object' && 'message' in createForm.formState.errors.items && (
                     <p className="text-sm font-medium text-destructive">{createForm.formState.errors.items.message as string}</p>
                  )}
               </div>
               {/* Notes (Bound to createForm) */}
               <FormField
                 control={createForm.control}
                 name={"notes"}
                 render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea placeholder="Optional notes..." {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                 )}
               />
             </CardContent>
             <CardFooter className="flex justify-between items-center">
               <span className="text-lg font-semibold">Total: {formatCurrency(calculateTotal(createForm))}</span>
               <Button type="submit" disabled={createOrderMutation.isPending}>{createOrderMutation.isPending ? 'Creating...' : 'Create Order'}</Button>
             </CardFooter>
           </Card>
        </form>
      </FormProvider>
    );
  }
} 