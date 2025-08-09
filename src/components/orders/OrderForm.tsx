// @ts-nocheck
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, type SubmitHandler, FormProvider, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Order, type OrderItem, OrderStatus, OrderType, type Customer, type InventoryItem, Prisma, type BillOfMaterial, type BillOfMaterialItem } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import {
  createOrderSchema,
  updateOrderSchema,
  CreateOrderInput,
  UpdateOrderInput,
  FINNISH_VAT_RATES,
} from "@/lib/schemas/order.schema";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Trash2, PlusCircle, UserPlus } from 'lucide-react';
import { ComboboxResponsive } from '@/components/ui/combobox-responsive';
import { formatCurrency } from '@/lib/utils';
import { parseNordicNumber, formatNordicNumber, isValidNordicNumber } from '@/lib/utils/nordic-numbers';
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
import OrderSubmissionModal from "./OrderSubmissionModal";
import { MarginCalculationCard } from "@/components/common/MarginCalculationCard";
import { SendConfirmationModal } from "@/components/common/SendConfirmationModal";

// Define form value types from Zod schemas
type CreateFormValues = z.infer<typeof createOrderSchema>;
type UpdateFormValues = z.infer<typeof updateOrderSchema>;

// Type for the form instances
type CreateFormInstance = UseFormReturn<CreateFormValues>;
type UpdateFormInstance = UseFormReturn<UpdateFormValues>;

// --- Processed Types for OrderForm Props (Decimals converted to numbers) ---

// Based on InventoryItem, but Decimals are numbers
type ProcessedInventoryItemForOrder = Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'minimumStockLevel' | 'reorderLevel' | 'defaultVatRatePercent'> & {
  costPrice: number;
  salesPrice: number;
  minimumStockLevel: number;
  reorderLevel: number;
  defaultVatRatePercent: number | null;
  // Include BOM data for manufactured goods
  bom?: {
    manualLaborCost: number;
    items: {
      quantity: number;
      componentItem: {
        costPrice: number;
      };
    }[];
  };
};

// Based on OrderItem, but Decimals are numbers, and inventoryItem is ProcessedInventoryItemForOrder
export type ProcessedOrderItem = Omit<OrderItem, 'quantity' | 'unitPrice' | 'discountAmount' | 'discountPercentage' | 'vatRatePercent' | 'inventoryItem'> & {
  quantity: number;
  unitPrice: number;
  discountAmount: number | null;
  discountPercentage: number | null;
  vatRatePercent: number | null;
  inventoryItem: ProcessedInventoryItemForOrder | null; // inventoryItem can be null if not properly included, though schema implies it
};

// Based on Order, but Decimals are numbers, and items are ProcessedOrderItem[]
export type ProcessedOrder = Omit<Order, 'totalAmount' | 'items'> & {
  totalAmount: number;
  items: ProcessedOrderItem[];
  // Retain other Order fields like customer, deliveryDate etc. implicitly from Omit<Order, ...>
  // Ensure deliveryDate is correctly typed if it's part of Order from @prisma/client
  deliveryDate?: Date | null; // Explicitly ensuring deliveryDate is available and correctly typed
};
// --- End Processed Types ---

// Props for the OrderForm
type OrderFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: {
    id: string;
    name: string;
    salesPrice: number; // Changed from Decimal (Prisma.Decimal)
    unitOfMeasure: string;
    sku: string; // Added SKU
  }[];
  order?: ProcessedOrder; // Use the new ProcessedOrder type
  isEditMode?: boolean;
  initialData?: ProcessedOrder;
  companyId?: string;
  searchParams?: { customerId?: string; orderType?: string };
};

// Removed OrderFormContent abstraction

export default function OrderForm({ customers: initialCustomers, inventoryItems, order, isEditMode = false, initialData, companyId, searchParams }: OrderFormProps) {
  const router = useRouter();
  const utils = api.useUtils(); // For cache invalidation
  const [customers, setCustomers] = useState(initialCustomers);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);

  // --- Create Form Setup ---
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
        customerId: searchParams?.customerId || '',
        notes: '',
        status: OrderStatus.draft,
        orderType: searchParams?.orderType === 'QUOTATION' ? OrderType.quotation : 
                   searchParams?.orderType === 'WORK_ORDER' ? OrderType.work_order : 
                   OrderType.work_order, // Default to work_order
        orderDate: new Date(), // Added orderDate
        deliveryDate: undefined, // Added deliveryDate
        items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0, vatRatePercent: 25.5, discountAmount: null, discountPercent: null }],
    },
  });
  const { fields: createFields, append: createAppend, remove: createRemove } = useFieldArray({
    control: createForm.control,
    name: "items",
    keyName: "key",
  });

  // --- Update Form Setup ---
  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateOrderSchema),
    defaultValues: undefined,
  });
   const { fields: updateFields, append: updateAppend, remove: updateRemove } = useFieldArray({
    control: updateForm.control,
    name: "items",
    keyName: "key",
  });

  useEffect(() => {
    if (isEditMode && order) {
        updateForm.reset({
            id: order.id,
            customerId: order.customerId,
            notes: order.notes ?? '',
            status: order.status, 
            orderType: order.orderType ?? OrderType.work_order, 
            deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : undefined, 
            items: order.items.map((orderItem: ProcessedOrderItem) => ({
                id: orderItem.id,
                inventoryItemId: orderItem.inventoryItemId, 
                quantity: orderItem.quantity,
                unitPrice: orderItem.unitPrice,
                vatRatePercent: orderItem.vatRatePercent ?? 25.5, // Add VAT rate with fallback
                discountAmount: orderItem.discountAmount ?? null,
                discountPercent: orderItem.discountPercentage ?? null, // Prisma model uses discountPercentage
            })),
        });
    } else if (!isEditMode && !searchParams) {
        // Only reset to defaults if no searchParams are provided
        createForm.reset({
            customerId: '',
            notes: '',
            status: OrderStatus.draft,
            orderType: OrderType.work_order,
            orderDate: new Date(),
            deliveryDate: undefined,
            items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0, vatRatePercent: 25.5, discountAmount: null, discountPercent: null }],
        });
    }
  }, [order, isEditMode, updateForm, createForm, searchParams]);

  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ id: string; orderNumber: string; orderType: OrderType } | null>(null);

  const createOrderMutation = api.order.create.useMutation({
    onSuccess: (data) => {
      setCreatedOrder({
        id: data.id,
        orderNumber: data.orderNumber,
        orderType: data.orderType,
      });
      setShowSubmissionModal(true);
    },
    onError: (error) => {
      toast.error(`Failed to create order: ${error.message}`);
    },
  });

  const updateOrderMutation = api.order.update.useMutation({
    onSuccess: (data) => {
      toast.success("Order updated successfully!");
      router.push('/orders');
      router.refresh(); 
    },
    onError: (error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });

  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (newInvoice) => {
      toast.success(`Invoice ${newInvoice.invoiceNumber} created successfully!`);
      utils.order.getById.invalidate({ id: order?.id }); 
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const handleCreateSubmit: SubmitHandler<CreateFormValues> = (data) => {
    const processedData: CreateOrderInput = {
      ...data,
      deliveryDate: data.deliveryDate || null,
      items: (data.items || []).map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: item.discountAmount ? Number(item.discountAmount) : null,
        discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
      })),
    };
    createOrderMutation.mutate(processedData);
  };

  const handleUpdateSubmit: SubmitHandler<UpdateFormValues> = (data) => {
    if (!data.id) return toast.error("Cannot update order without an ID.");

    const processedData: Partial<UpdateOrderInput> = {
      id: data.id,
      ...(data.customerId && { customerId: data.customerId }),
      ...(data.orderDate && { orderDate: data.orderDate }),
      ...(data.deliveryDate !== undefined && { deliveryDate: data.deliveryDate || null }),
      ...(data.orderType && { orderType: data.orderType }),
      ...(data.notes !== undefined && { notes: data.notes }),
    };

    if (data.items) {
        processedData.items = data.items.map(item => ({
            id: item.id,
            inventoryItemId: item.inventoryItemId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountAmount: item.discountAmount ? Number(item.discountAmount) : null,
            discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
        }));
    }
    
    updateOrderMutation.mutate(processedData as UpdateOrderInput);
  };

  const handleCreateInvoice = (orderId?: string) => {
    if (!orderId) {
      toast.error("Order ID is missing, cannot create invoice.");
      return;
    }
    createInvoiceMutation.mutate({ orderId, dueDate: new Date(new Date().setDate(new Date().getDate() + 14)) }); 
  };

  const handleItemChange = (index: number, itemId: string, formInstance: CreateFormInstance | UpdateFormInstance) => {
    const selectedItem = inventoryItems.find(invItem => invItem.id === itemId);
    if (selectedItem) {
      if (isEditMode) {
        const updateFormInstance = formInstance as UpdateFormInstance;
        updateFormInstance.setValue(`items.${index}.inventoryItemId`, selectedItem.id, { shouldValidate: true });
        updateFormInstance.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice, { shouldValidate: true });
      } else {
        const createFormInstance = formInstance as CreateFormInstance;
        createFormInstance.setValue(`items.${index}.inventoryItemId`, selectedItem.id, { shouldValidate: true });
        createFormInstance.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice, { shouldValidate: true });
      }
    }
  };

  const calculateTotal = (formInstance: CreateFormInstance | UpdateFormInstance) => {
    let items: CreateFormValues['items'] | UpdateFormValues['items'] = [];
    if (isEditMode) {
      items = (formInstance as UpdateFormInstance).watch("items");
    } else {
      items = (formInstance as CreateFormInstance).watch("items");
    }

    return Array.isArray(items) ? items.reduce((total: number, item: any) => { 
      const quantity = Number(item?.quantity) || 0;
      const price = Number(item?.unitPrice) || 0;
      let lineTotal = quantity * price;

      const discountPercent = item?.discountPercent;
      const discountAmount = item?.discountAmount;

      if (discountPercent != null && discountPercent > 0) {
        lineTotal = lineTotal * (1 - discountPercent / 100);
      } else if (discountAmount != null && discountAmount > 0) {
        lineTotal = Math.max(0, lineTotal - discountAmount);
      }
      return total + lineTotal;
    }, 0) : 0;
  };

  const calculateVATTotal = (formInstance: CreateFormInstance | UpdateFormInstance) => {
    let items: CreateFormValues['items'] | UpdateFormValues['items'] = [];
    if (isEditMode) {
      items = (formInstance as UpdateFormInstance).watch("items");
    } else {
      items = (formInstance as CreateFormInstance).watch("items");
    }

    return Array.isArray(items) ? items.reduce((vatTotal: number, item: any) => { 
      const quantity = Number(item?.quantity) || 0;
      const price = Number(item?.unitPrice) || 0;
      const vatRate = Number(item?.vatRatePercent) || 0;
      let lineTotal = quantity * price;

      const discountPercent = item?.discountPercent;
      const discountAmount = item?.discountAmount;

      if (discountPercent != null && discountPercent > 0) {
        lineTotal = lineTotal * (1 - discountPercent / 100);
      } else if (discountAmount != null && discountAmount > 0) {
        lineTotal = Math.max(0, lineTotal - discountAmount);
      }
      
      const vatAmount = lineTotal * (vatRate / 100);
      return vatTotal + vatAmount;
    }, 0) : 0;
  };

  const calculateGrandTotal = (formInstance: CreateFormInstance | UpdateFormInstance) => {
    const subtotal = calculateTotal(formInstance);
    const vatTotal = calculateVATTotal(formInstance);
    return subtotal + vatTotal;
  };

  const calculateLineTotal = (item: any, formInstance: CreateFormInstance | UpdateFormInstance) => {
    const quantity = new Prisma.Decimal(item.quantity || 0);
    const unitPrice = new Prisma.Decimal(item.unitPrice || 0);
    let lineTotal = quantity.mul(unitPrice);

    const discountPercent = item.discountPercent; // Schema uses discountPercent
    const discountAmount = item.discountAmount;

    if (discountPercent != null && discountPercent > 0) {
      const discountMultiplier = new Prisma.Decimal(1).minus(
        new Prisma.Decimal(discountPercent).div(100)
      );
      lineTotal = lineTotal.times(discountMultiplier);
    } else if (discountAmount != null && discountAmount > 0) {
      const discountFixed = new Prisma.Decimal(discountAmount);
      lineTotal = lineTotal.sub(discountFixed).greaterThanOrEqualTo(0) ? lineTotal.sub(discountFixed) : new Prisma.Decimal(0);
    }
    return lineTotal.toDP(2).toNumber();
  };

  const [showSendModal, setShowSendModal] = React.useState(false);

  if (isEditMode) {
    if (!order && !updateForm.formState.isDirty) {
        return <div>Loading order data...</div>;
    }

    return (
      <FormProvider {...updateForm}>
        <form onSubmit={updateForm.handleSubmit(handleUpdateSubmit)} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Edit Order</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <FormField
                 control={updateForm.control}
                 name={"customerId"}
                 render={({ field }) => {
                   const customerOptions = customers.map(customer => ({
                     value: customer.id,
                     label: customer.name
                   }));
                   
                   return (
                     <FormItem>
                       <FormLabel>Customer</FormLabel>
                       <ComboboxResponsive
                         options={customerOptions}
                         selectedValue={field.value || ''}
                         onSelectedValueChange={field.onChange}
                         placeholder="Select a customer..."
                         searchPlaceholder="Search customers..."
                         disabled={true}
                       />
                       <FormMessage />
                     </FormItem>
                   );
                 }}
               />
              
              <FormField
                control={updateForm.control}
                name={"orderType"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={true}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select order type" /></SelectTrigger></FormControl>
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

              <FormField
                control={updateForm.control}
                name={"deliveryDate"}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                        disabled={updateOrderMutation.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      When this order should be delivered to the customer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                <FormLabel>Order Items</FormLabel>
                <div className="overflow-x-auto">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">SKU</TableHead>
                        <TableHead className="min-w-[180px]">Item</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[110px]">Unit Price</TableHead>
                        <TableHead className="w-[80px]">VAT %</TableHead>
                        <TableHead className="w-[110px]">Discount %</TableHead>
                        <TableHead className="w-[110px]">Discount Amt.</TableHead>
                        <TableHead className="w-[130px] text-right">Line Total</TableHead>
                        <TableHead className="w-[60px]">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {updateFields.map((field, index) => (
                      <TableRow key={field.key}>
                        {/* SKU Column */}
                        <TableCell>
                          <ComboboxResponsive
                            onSelectedValueChange={(value) => {
                              const selectedItem = inventoryItems.find(item => item.sku === value);
                              if (selectedItem) {
                                updateForm.setValue(`items.${index}.inventoryItemId`, selectedItem.id);
                                handleItemChange(index, selectedItem.id, updateForm);
                              }
                            }}
                            selectedValue={updateForm.watch(`items.${index}.inventoryItemId`) ? inventoryItems.find(i => i.id === updateForm.watch(`items.${index}.inventoryItemId`))?.sku || '' : ''}
                            options={inventoryItems.map(i => ({
                              value: i.sku,
                              label: i.sku
                            }))}
                            placeholder="SKU..."
                            searchPlaceholder="Search SKU..."
                            disabled={updateOrderMutation.isPending}
                          />
                        </TableCell>
                        <TableCell>
                           <FormField
                              control={updateForm.control}
                              name={`items.${index}.inventoryItemId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="sr-only">Item</FormLabel>
                                                                     <ComboboxResponsive
                                     onSelectedValueChange={(value) => { field.onChange(value); handleItemChange(index, value, updateForm); }}
                                     selectedValue={field.value}
                                     options={inventoryItems.map(i => ({
                                       value: i.id,
                                       label: i.name
                                     }))}
                                     placeholder="Select item..."
                                     searchPlaceholder="Search items..."
                                     disabled={updateOrderMutation.isPending}
                                   />
                                  <FormMessage />
                                </FormItem>
                              )}
                             />
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="text"
                                    value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '') {
                                        field.onChange(0);
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
                                        field.onChange(0);
                                      }
                                      field.onBlur();
                                    }}
                                    placeholder="e.g. 2,5"
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[120px] text-right">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Unit Price</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="text"
                                    value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '') {
                                        field.onChange(0);
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
                                        field.onChange(0);
                                      }
                                      field.onBlur();
                                    }}
                                    placeholder="e.g. 15,50"
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.vatRatePercent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">VAT %</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseFloat(value))} value={field.value?.toString()} disabled={updateOrderMutation.isPending}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="VAT %" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {FINNISH_VAT_RATES.map(rate => (
                                      <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.discountPercent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Discount %</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="text"
                                    value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 1) : ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '') {
                                        field.onChange(null);
                                        updateForm.setValue(`items.${index}.discountAmount`, null);
                                        return;
                                      }
                                      
                                      if (isValidNordicNumber(value)) {
                                        const numericValue = parseNordicNumber(value);
                                        if (!isNaN(numericValue)) {
                                          field.onChange(numericValue);
                                          
                                          // Auto-calculate discount amount when percent changes
                                          if (numericValue > 0) {
                                            const currentItem = updateForm.getValues(`items.${index}`);
                                            const rowTotal = (currentItem.quantity || 0) * (currentItem.unitPrice || 0);
                                            const discountAmount = rowTotal * (numericValue / 100);
                                            updateForm.setValue(`items.${index}.discountAmount`, discountAmount);
                                          } else {
                                            updateForm.setValue(`items.${index}.discountAmount`, null);
                                          }
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
                                    placeholder="e.g. 10,0"
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <FormField
                            control={updateForm.control}
                            name={`items.${index}.discountAmount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Discount Amount</FormLabel>
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
                                    placeholder="e.g. 5,00"
                                    disabled={updateOrderMutation.isPending} 
                                    className="text-right" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateLineTotal(updateForm.watch(`items.${index}`), updateForm))}</TableCell>
                        <TableCell><Button type="button" variant="destructive" size="sm" onClick={() => updateRemove(index)} disabled={updateFields.length <= 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <Button type="button" variant="outline" onClick={() => updateAppend({ inventoryItemId: '', quantity: 1, unitPrice: 0, discountAmount: null, discountPercent: null })} >Add Item</Button> 
                 {updateForm.formState.errors.items && typeof updateForm.formState.errors.items === 'object' && 'message' in updateForm.formState.errors.items && (
                    <p className="text-sm font-medium text-destructive">{updateForm.formState.errors.items.message as string}</p>
                 )}
              </div>
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
            <CardFooter className="flex justify-end space-x-2">
              <span className="text-lg font-semibold mr-auto">Total: {formatCurrency(calculateTotal(updateForm))}</span>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={updateOrderMutation.isPending || createInvoiceMutation.isPending} className="mr-2">Cancel</Button>
              <Button type="button" className="mr-2" onClick={() => setShowSendModal(true)} disabled={updateOrderMutation.isPending}>Send Order</Button>
              <Button 
                  type="submit" 
                  variant="secondary"
                  disabled={updateOrderMutation.isPending || createInvoiceMutation.isPending || (updateForm.formState.isSubmitted && !updateForm.formState.isValid)}
              >
                  Save Draft
              </Button>
              <Button 
                  type="button" 
                  variant="secondary"
                  onClick={() => handleCreateInvoice(order?.id)}
                  disabled={!order || updateOrderMutation.isPending || createInvoiceMutation.isPending || order.status === OrderStatus.invoiced || order.status === OrderStatus.cancelled}
              >
                  {createInvoiceMutation.isPending ? "Creating Invoice..." : "Create Invoice"}
              </Button>
              <SendConfirmationModal
                target="order"
                open={showSendModal}
                onOpenChange={setShowSendModal}
                onConfirm={async (method) => {
                  toast.info(`Would send order via ${method}`);
                }}
              />
            </CardFooter>
          </Card>
        </form>
      </FormProvider>
    );

  } else {
    return (
      <>
        <FormProvider {...createForm}>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle>Create New Order</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <FormField
                   control={createForm.control}
                   name={"customerId"}
                   render={({ field }) => {
                     const customerOptions = customers.map(customer => ({
                       value: customer.id,
                       label: customer.name
                     }));
                     
                     return (
                       <FormItem>
                         <FormLabel>Customer</FormLabel>
                         <div className="flex items-center gap-2">
                           <div className="flex-1">
                             <ComboboxResponsive
                               options={customerOptions}
                               selectedValue={field.value || ''}
                               onSelectedValueChange={field.onChange}
                               placeholder="Select a customer..."
                               searchPlaceholder="Search customers..."
                             />
                           </div>
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
                     );
                   }}
                 />
                
                <FormField
                  control={createForm.control}
                  name={"orderType"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select order type" /></SelectTrigger></FormControl>
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

                <FormField
                  control={createForm.control}
                  name={"deliveryDate"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                          disabled={createOrderMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        When this order should be delivered to the customer.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>Items</FormLabel>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">SKU</TableHead>
                          <TableHead className="min-w-[200px]">Item</TableHead>
                          <TableHead className="w-[80px]">Quantity</TableHead>
                          <TableHead className="w-[110px]">Unit Price</TableHead>
                          <TableHead className="w-[80px]">VAT %</TableHead>
                          <TableHead className="w-[90px]">Disc %</TableHead>
                          <TableHead className="w-[90px]">Disc Amt</TableHead>
                          <TableHead className="w-[110px] text-right">Total</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {createFields.map((item, index) => {
                          const currentItemValues = createForm.watch(`items.${index}`);
                          const itemTotal = calculateLineTotal(currentItemValues, createForm);
                          return (
                            <TableRow key={item.key}>
                              {/* SKU Column */}
                              <TableCell>
                                <ComboboxResponsive
                                  onSelectedValueChange={(value) => {
                                    const selectedItem = inventoryItems.find(item => item.sku === value);
                                    if (selectedItem) {
                                      createForm.setValue(`items.${index}.inventoryItemId`, selectedItem.id);
                                      handleItemChange(index, selectedItem.id, createForm);
                                    }
                                  }}
                                  selectedValue={currentItemValues?.inventoryItemId ? inventoryItems.find(i => i.id === currentItemValues.inventoryItemId)?.sku || '' : ''}
                                  options={inventoryItems.map(i => ({
                                    value: i.sku,
                                    label: i.sku
                                  }))}
                                  placeholder="SKU..."
                                  searchPlaceholder="Search SKU..."
                                  disabled={createOrderMutation.isPending}
                                />
                              </TableCell>
                              <TableCell className="min-w-[200px]">
                                <FormField
                                  control={createForm.control}
                                  name={`items.${index}.inventoryItemId`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="sr-only">Item</FormLabel>
                                                                             <ComboboxResponsive
                                         onSelectedValueChange={(value) => { field.onChange(value); handleItemChange(index, value, createForm); }}
                                         selectedValue={field.value}
                                         options={inventoryItems.map(i => ({
                                           value: i.id,
                                           label: i.name
                                         }))}
                                         placeholder="Select item..."
                                         searchPlaceholder="Search items..."
                                         disabled={createOrderMutation.isPending}
                                         className="min-w-[180px]"
                                       />
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
                                      <FormControl>
                                        <Input 
                                          type="text"
                                          value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              field.onChange(0);
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
                                              field.onChange(0);
                                            }
                                            field.onBlur();
                                          }}
                                          placeholder="e.g. 2,5"
                                          disabled={createOrderMutation.isPending} 
                                          className="text-right w-[80px]" 
                                        />
                                      </FormControl>
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
                                      <FormLabel className="sr-only">Unit Price</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="text"
                                          value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              field.onChange(0);
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
                                              field.onChange(0);
                                            }
                                            field.onBlur();
                                          }}
                                          placeholder="e.g. 15,50"
                                          disabled={createOrderMutation.isPending} 
                                          className="text-right w-[100px]" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={createForm.control}
                                  name={`items.${index}.vatRatePercent`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="sr-only">VAT %</FormLabel>
                                      <Select onValueChange={(value) => field.onChange(parseFloat(value))} value={field.value?.toString()} disabled={createOrderMutation.isPending}>
                                        <FormControl>
                                          <SelectTrigger className="w-[80px]">
                                            <SelectValue placeholder="VAT" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {FINNISH_VAT_RATES.map(rate => (
                                            <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={createForm.control}
                                  name={`items.${index}.discountPercent`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          type="text"
                                          value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 1) : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              field.onChange(null);
                                              createForm.setValue(`items.${index}.discountAmount`, null);
                                              return;
                                            }
                                            
                                            if (isValidNordicNumber(value)) {
                                              const numericValue = parseNordicNumber(value);
                                              if (!isNaN(numericValue)) {
                                                field.onChange(numericValue);
                                                
                                                // Auto-calculate discount amount when percent changes
                                                if (numericValue > 0) {
                                                  const currentItem = createForm.getValues(`items.${index}`);
                                                  const rowTotal = (currentItem.quantity || 0) * (currentItem.unitPrice || 0);
                                                  const discountAmount = rowTotal * (numericValue / 100);
                                                  createForm.setValue(`items.${index}.discountAmount`, discountAmount);
                                                } else {
                                                  createForm.setValue(`items.${index}.discountAmount`, null);
                                                }
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
                                          placeholder="e.g. 10,0"
                                          className="text-right w-[80px]" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={createForm.control}
                                  name={`items.${index}.discountAmount`}
                                  render={({ field }) => (
                                    <FormItem>
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
                                          placeholder="e.g. 5,00"
                                          className="text-right w-[80px]" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">{formatCurrency(itemTotal)}</TableCell>
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
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => createAppend({ inventoryItemId: '', quantity: 1, unitPrice: 0, vatRatePercent: 25.5, discountAmount: null, discountPercent: null })} 
                    variant="outline" 
                    className="mt-4 w-full md:w-auto"
                    disabled={createOrderMutation.isPending}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                  {createForm.formState.errors.items && typeof createForm.formState.errors.items === 'object' && 'message' in createForm.formState.errors.items && (
                    <p className="text-sm font-medium text-destructive">{(createForm.formState.errors.items as any).message as string}</p>
                  )}
                </div>

                <div className="flex justify-end pt-6">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(calculateTotal(createForm))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT</span>
                      <span>{formatCurrency(calculateVATTotal(createForm))}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total</span>
                      <span>{formatCurrency(calculateGrandTotal(createForm))}</span>
                    </div>
                  </div>
                </div>

                {/* Margin Calculation Card - Only show for quotations */}
                {createForm.watch("orderType") === OrderType.quotation && (
                  <MarginCalculationCard
                    items={createForm.watch("items")?.map(item => {
                      const invItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
                      if (!invItem) {
                        console.warn(`Inventory item not found for ID: ${item.inventoryItemId}`);
                        return null;
                      }
                      
                      return {
                        quantity: item.quantity || 0,
                        unitPrice: item.unitPrice || 0,
                        discountAmount: item.discountAmount || null,
                        discountPercentage: item.discountPercent || null,
                        inventoryItem: {
                          itemType: invItem.itemType, // Use actual item type
                          costPrice: invItem.costPrice, // Use actual cost price
                          // Include BOM data for manufactured goods
                          bom: invItem.itemType === 'MANUFACTURED_GOOD' && invItem.bom ? {
                            manualLaborCost: invItem.bom.manualLaborCost,
                            items: invItem.bom.items?.map(bomItem => ({
                              quantity: bomItem.quantity,
                              componentItem: {
                                costPrice: bomItem.componentItem.costPrice
                              }
                            }))
                          } : null
                        },
                      };
                    }).filter((item): item is NonNullable<typeof item> => item !== null) || []}
                    customerId={createForm.watch("customerId")}
                    showCalculateButton={true}
                    className="mt-6"
                  />
                )}

                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} className="mr-2" disabled={createOrderMutation.isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createOrderMutation.isPending || (createForm.formState.isSubmitted && !createForm.formState.isValid)}>
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
                  utils.customer.list.invalidate(); 
                }
                setIsAddCustomerDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Order Submission Modal */}
        {createdOrder && (
          <OrderSubmissionModal
            isOpen={showSubmissionModal}
            onOpenChange={setShowSubmissionModal}
            orderId={createdOrder.id}
            orderType={createdOrder.orderType}
            orderNumber={createdOrder.orderNumber}
          />
        )}
      </>
    );
  }
} 