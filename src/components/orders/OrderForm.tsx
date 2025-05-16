"use client";

// Original imports might be needed later, keep them commented for now
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, type SubmitHandler, FormProvider, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Order, type OrderItem, OrderStatus, OrderType, type Customer, type InventoryItem, Prisma } from "@prisma/client";
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
import { Trash2, PlusCircle, UserPlus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { z } from 'zod';
import { PlusCircle as PlusCircleIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

// Dialog and CustomerForm imports
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customers/CustomerForm";

// Define form value types from Zod schemas
type CreateFormValues = z.infer<typeof createOrderSchema>;
type UpdateFormValues = z.infer<typeof updateOrderSchema>;

// Type for the form instances
type CreateFormInstance = UseFormReturn<CreateFormValues>;
type UpdateFormInstance = UseFormReturn<UpdateFormValues>;

// Define the payload type for order items with the related item (InventoryItem)
export type OrderItemWithRelatedItem = Prisma.OrderItemGetPayload<{
  select: {
    id: true;
    orderId: true;
    inventoryItemId: true; // Aligned with new schema FK name
    quantity: true;
    unitPrice: true;
    discountAmount: true;
    discountPercentage: true; // Aligned with new schema field name
    // notes: true; 
    inventoryItem: { // Aligned with new schema relation name
      select: {
        id: true;
        name: true;
        sku: true; 
        salesPrice: true; 
        unitOfMeasure: true; 
      }
    }
  }
}>;

// Props for the OrderForm
type OrderFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure'>[];
  order?: Order & { items: OrderItemWithRelatedItem[] }; // Uses the updated OrderItemWithRelatedItem
  isEditMode?: boolean;
};

// Removed OrderFormContent abstraction

export default function OrderForm({ customers: initialCustomers, inventoryItems, order, isEditMode = false }: OrderFormProps) {
  const router = useRouter();
  const utils = api.useUtils(); // For cache invalidation
  const [customers, setCustomers] = useState(initialCustomers);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);

  // --- Create Form Setup ---
  const createForm = useForm<CreateFormValues>({
    // Cast resolver to any to bypass schema conflict temporarily
    resolver: zodResolver(createOrderSchema) as any, 
    defaultValues: {
      customerId: '',
      notes: '',
      status: OrderStatus.draft,
      orderType: OrderType.work_order, // Default to work_order
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
            status: order.status, 
            orderType: order.orderType ?? OrderType.work_order, 
            deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : undefined, 
            items: order.items.map((orderItem: OrderItemWithRelatedItem) => ({ 
                id: orderItem.id,
                itemId: orderItem.inventoryItemId, // Map from inventoryItemId (schema) to Zod schema's itemId
                quantity: (orderItem.quantity as any).toNumber(), 
                unitPrice: (orderItem.unitPrice as any).toNumber(), 
                discountAmount: (orderItem.discountAmount as any)?.toNumber() ?? 0,
                discountPercent: (orderItem.discountPercentage as any)?.toNumber() ?? 0, // Map from discountPercentage (schema) to Zod schema's discountPercent
            })),
        });
    } else if (!isEditMode) {
        // Reset create form when switching back to create mode (or initial load)
        createForm.reset({
            customerId: '',
            notes: '',
            status: OrderStatus.draft,
            orderType: OrderType.work_order, // Default to work_order
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
      if (isEditMode) {
        const updateFormInstance = formInstance as UpdateFormInstance;
        updateFormInstance.setValue(`items.${index}.itemId`, selectedItem.id, { shouldValidate: true });
        updateFormInstance.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice.toNumber(), { shouldValidate: true });
        // Potentially set discountPercentage if needed from selectedItem
      } else {
        const createFormInstance = formInstance as CreateFormInstance;
        createFormInstance.setValue(`items.${index}.itemId`, selectedItem.id, { shouldValidate: true });
        createFormInstance.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice.toNumber(), { shouldValidate: true });
      }
    }
  };

  const calculateTotal = (formInstance: CreateFormInstance | UpdateFormInstance) => {
    // Cast formInstance based on mode to resolve watch union type issue
    let items: CreateFormValues['items'] | UpdateFormValues['items'] = [];
    if (isEditMode) {
      items = (formInstance as UpdateFormInstance).watch("items");
    } else {
      items = (formInstance as CreateFormInstance).watch("items");
    }

    return Array.isArray(items) ? items.reduce((total: number, item: any) => { // Keep 'any' here for now, focus on build error
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
              
              {/* Order Type Selection (Bound to updateForm) */}
              <FormField
                control={updateForm.control}
                name={"orderType"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={OrderType.work_order}>Work Order</SelectItem>
                        <SelectItem value={OrderType.quotation}>Quotation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === OrderType.work_order ? 
                        "Work orders track production and can generate invoices." : 
                        "Quotations provide pricing information to customers."}
                    </FormDescription>
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
                      <TableHead>Discount %</TableHead>
                      <TableHead>Discount Amt</TableHead>
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
                        <TableCell className="w-[10%]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl><Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={updateOrderMutation.isPending} className="text-right" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[15%] text-right">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={updateOrderMutation.isPending} className="text-right" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[10%]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.discountPercent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Discount %</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="%" 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[10%]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.discountAmount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Discount Amt</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="Amt" 
                                    {...field} 
                                    value={field.value ?? ''}
                                    onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} 
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[10%] text-right">{formatCurrency((Number(updateForm.watch(`items.${index}.quantity`)) || 0) * (Number(updateForm.watch(`items.${index}.unitPrice`)) || 0))}</TableCell>
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
      <>
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
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger></FormControl>
                          <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button 
                          type="button" 
                          variant="outline"
                          size="icon"
                          onClick={() => setIsAddCustomerDialogOpen(true)}
                        >
                          <UserPlus className="h-4 w-4" />
                          <span className="sr-only">Add New Customer</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Order Type Selection (Bound to createForm) */}
                <FormField
                  control={createForm.control}
                  name={"orderType"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={OrderType.work_order}>Work Order</SelectItem>
                          <SelectItem value={OrderType.quotation}>Quotation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === OrderType.work_order ? 
                          "Work orders track production and can generate invoices." : 
                          "Quotations provide pricing information to customers."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Items Table (Bound to createForm) */}
                <div>
                  <FormLabel>Items</FormLabel>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-2/5">Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createFields.map((item, index) => {
                        const currentItem = createForm.watch(`items.${index}`);
                        const itemTotal = (Number(currentItem?.quantity) || 0) * (Number(currentItem?.unitPrice) || 0);
                        return (
                          <TableRow key={item.key}>
                            <TableCell>
                              <FormField
                                control={createForm.control}
                                name={`items.${index}.itemId`}
                                render={({ field }) => (
                                  <FormItem>
                                    <Select onValueChange={(value) => { field.onChange(value); handleItemChange(index, value, createForm); }} defaultValue={field.value}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger></FormControl>
                                      <SelectContent>{inventoryItems.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.name}</SelectItem>)}</SelectContent>
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
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={createForm.control}
                                name={`items.${index}.unitPrice`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(itemTotal)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => createRemove(index)} disabled={createFields.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => createAppend({ itemId: '', quantity: 1, unitPrice: 0 })}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>

                {/* Notes (Bound to createForm) */}
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()} className="mr-2">
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrderMutation.isPending}>
                  {createOrderMutation.isPending ? "Creating..." : "Create Order"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </FormProvider>

        <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <CustomerForm 
              onSuccessCallback={(createdCustomerId) => {
                if (createdCustomerId) {
                  createForm.setValue("customerId", createdCustomerId, { shouldValidate: true });
                  // Consider refetching customers or updating local 'customers' state for the dropdown
                  utils.customer.list.invalidate(); // Relies on parent/global state to update customers prop
                }
                setIsAddCustomerDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }
} 