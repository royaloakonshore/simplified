"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { type Customer, type InventoryItem } from "@prisma/client";
import Decimal from 'decimal.js';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';

import { 
  CreateInvoiceSchema, 
  type CreateInvoiceInput, 
  FINNISH_VAT_RATES,
  invoiceFormValidationSchema,
  type InvoiceFormValues
} from "@/lib/schemas/invoice.schema";
import { api } from "@/lib/trpc/react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import { parseNordicNumber, formatNordicNumber, isValidNordicNumber } from "@/lib/utils/nordic-numbers";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerForm } from "@/components/customers/CustomerForm";
import InvoiceSubmissionModal from "./InvoiceSubmissionModal";
import { MarginCalculationCard } from "@/components/common/MarginCalculationCard";
import { ComboboxResponsive } from '@/components/ui/combobox-responsive';
import { SendConfirmationModal } from "@/components/common/SendConfirmationModal";

type InvoiceFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: {
    id: string;
    name: string;
    salesPrice: number;
    unitOfMeasure: string;
    sku: string;
    itemType: string;
    costPrice: number;
    bom?: {
      manualLaborCost: number;
      items?: {
        quantity: number;
        componentItem: {
          costPrice: number;
        };
      }[];
    };
  }[];
  isEditMode?: boolean;
  order?: any;
  editInvoiceData?: any;
};

type InventoryItemFormData = {
  id: string;
  name: string;
  salesPrice: number;
  unitOfMeasure: string;
  sku: string;
};

export default function InvoiceForm({ customers: initialCustomers, inventoryItems, isEditMode = false, order, editInvoiceData }: InvoiceFormProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = React.useState(false);

  const getDefaultValues = () => {
    // If editing an existing invoice, populate with that data
    if (isEditMode && editInvoiceData) {
      return {
        customerId: editInvoiceData.customerId || '',
        invoiceDate: editInvoiceData.invoiceDate ? new Date(editInvoiceData.invoiceDate) : new Date(),
        dueDate: editInvoiceData.dueDate ? new Date(editInvoiceData.dueDate) : new Date(new Date().setDate(new Date().getDate() + 14)),
        paymentTerms: '14', // Default to 14 days
        notes: editInvoiceData.notes || '',
        ourReference: editInvoiceData.ourReference || '',
        customerNumber: editInvoiceData.customerNumber || '',
        deliveryMethod: editInvoiceData.deliveryMethod || '',
        deliveryDate: editInvoiceData.deliveryDate ? new Date(editInvoiceData.deliveryDate) : null,
        complaintPeriod: editInvoiceData.complaintPeriod || '',
        penaltyInterest: editInvoiceData.penaltyInterest ? parseFloat(editInvoiceData.penaltyInterest.toString()) : null,
        paymentTermsDays: editInvoiceData.paymentTermsDays || 14,
        vatReverseCharge: editInvoiceData.vatReverseCharge || false,
        items: editInvoiceData.items?.map((item: any) => ({
          itemId: item.inventoryItemId || '',
          description: item.description || '',
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          vatRatePercent: parseFloat(item.vatRatePercent) || 25.5,
          discountAmount: item.discountAmount ? parseFloat(item.discountAmount) : null,
          discountPercent: item.discountPercentage ? parseFloat(item.discountPercentage) : null,
        })) || [{
          itemId: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          vatRatePercent: 25.5,
          discountAmount: null,
          discountPercent: null,
        }],
      };
    }

    // If creating from an order, populate with order data
    if (order) {
      return {
        customerId: order.customerId || '',
        invoiceDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
        paymentTerms: '14', // Default to 14 days
        notes: order.notes || '',
        ourReference: order.ourReference || '',
        customerNumber: order.customerNumber || '',
        deliveryMethod: '',
        deliveryDate: null,
        complaintPeriod: '7 vrk',
        penaltyInterest: 10.5,
        paymentTermsDays: 14,
        vatReverseCharge: false,
        items: order.items?.map((item: any) => ({
          itemId: item.inventoryItemId || '',
          description: item.inventoryItem?.name || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          vatRatePercent: item.vatRatePercent || 25.5,
          discountAmount: item.discountAmount || null,
          discountPercent: item.discountPercentage || null,
        })) || [{
          itemId: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          vatRatePercent: 25.5,
          discountAmount: null,
          discountPercent: null,
        }],
      };
    }

    // Default values for new invoice
    return {
      customerId: '',
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      paymentTerms: '14', // Default to 14 days
      notes: '',
      ourReference: '',
      customerNumber: '',
      deliveryMethod: '',
      deliveryDate: null,
      complaintPeriod: '7 vrk',
      penaltyInterest: 10.5,
      paymentTermsDays: 14,
      vatReverseCharge: false,
      items: [{
        itemId: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRatePercent: 25.5,
        discountAmount: null,
        discountPercent: null,
      }],
    };
  };

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormValidationSchema),
    defaultValues: getDefaultValues(),
    mode: "onBlur"
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const [showSubmissionModal, setShowSubmissionModal] = React.useState(false);
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [createdInvoice, setCreatedInvoice] = React.useState<{ id: string; invoiceNumber: string } | null>(null);

  const selectedCustomerId = form.watch("customerId");

  const { data: selectedCustomer } = api.customer.getById.useQuery(
    { id: selectedCustomerId },
    {
      enabled: !!selectedCustomerId,
      staleTime: Infinity,
    }
  );

  React.useEffect(() => {
    if (selectedCustomer) {
      // Auto-fill customer number if available
      if ('customerNumber' in selectedCustomer && selectedCustomer.customerNumber) {
        form.setValue("customerNumber", selectedCustomer.customerNumber);
      }
      
      // Auto-fill billing address and customer details for Finvoice integration
      if ('addresses' in selectedCustomer && selectedCustomer.addresses) {
        const billingAddress = selectedCustomer.addresses?.find((addr: any) => addr.type === 'billing');
        
        // Set delivery method from customer's address if not already set
        if (billingAddress && !form.getValues("deliveryMethod")) {
          // Use customer's city as a basis for delivery method suggestion
          const cityDelivery = billingAddress.city ? `Toimitus: ${billingAddress.city}` : "";
          if (cityDelivery) {
            form.setValue("deliveryMethod", cityDelivery);
          }
        }
      }
      
      // Auto-fill buyer reference if available and not already set
      if ('buyerReference' in selectedCustomer && selectedCustomer.buyerReference && !form.getValues("ourReference")) {
        form.setValue("ourReference", selectedCustomer.buyerReference);
      }
    }
  }, [selectedCustomer, form]);

  const createInvoiceMutation = api.invoice.create.useMutation({
    onSuccess: (data) => {
      setCreatedInvoice({
        id: data.id,
        invoiceNumber: data.invoiceNumber,
      });
      setShowSubmissionModal(true);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating invoice:", error);
      if (error.data?.code === 'CONFLICT') {
         toast.error(error.message);
      } else {
         toast.error(`Failed to create invoice: ${error.message}`);
      }
    },
  });

  const updateInvoiceMutation = api.invoice.update.useMutation({
    onSuccess: (data) => {
      toast.success("Invoice updated successfully!");
      router.push(`/invoices/${data.id}`);
    },
    onError: (error) => {
      console.error("Error updating invoice:", error);
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });

  const onSubmit: SubmitHandler<InvoiceFormValues> = (values) => {
    console.log("Form submitted (InvoiceFormValues):", values);

    const transformedForApi: CreateInvoiceInput = {
      customerId: values.customerId,
      invoiceDate: values.invoiceDate,
      dueDate: values.dueDate,
      notes: values.notes ?? null,
      ourReference: values.ourReference ?? null,
      customerNumber: values.customerNumber ?? null,
      deliveryMethod: values.deliveryMethod ?? null,
      complaintPeriod: values.complaintPeriod ?? null,
      penaltyInterest: values.penaltyInterest ?? null,
      items: values.items.map(item => ({
        ...(item.id && { id: item.id }),
        itemId: item.itemId,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRatePercent: Number(item.vatRatePercent),
        discountAmount: item.discountAmount ? Number(item.discountAmount) : null,
        discountPercentage: item.discountPercent ? Number(item.discountPercent) : null,
      })),
      orderId: values.orderId ?? undefined,
      vatReverseCharge: values.vatReverseCharge ?? false,
    };

    console.log("Transformed for API (CreateInvoiceInput shape):", transformedForApi);

    try {
      const validatedApiInput = CreateInvoiceSchema.parse(transformedForApi);
      console.log("Validated API Input:", validatedApiInput);

      if (isEditMode) {
        // Update existing invoice
        const updateData = {
          id: editInvoiceData?.id,
          ...validatedApiInput
        };
        updateInvoiceMutation.mutate(updateData);
      } else {
        createInvoiceMutation.mutate(validatedApiInput);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error preparing data for API:", error.errors);
        toast.error("There was an issue with the data provided. Please check the form and try again.");
        error.errors.forEach((err) => {
          const fieldName = err.path.join('.') as keyof InvoiceFormValues;
          try {
            form.setError(fieldName, { type: 'manual', message: err.message });
          } catch (e) {
            console.warn(`Could not set error on field ${fieldName}:`, e);
          }
        });
      } else {
        console.error("Error processing form submission:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleItemChange = (index: number, itemId: string) => {
    const selectedItem = inventoryItems.find(item => item.id === itemId) as InventoryItemFormData | undefined;
    if (selectedItem) {
      form.setValue(`items.${index}.description`, selectedItem.name ?? '', { shouldValidate: true });
      form.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice, { shouldValidate: true });
    }
  };

  const watchItems = form.watch("items");
  const watchVatReverseCharge = form.watch("vatReverseCharge");

  const subTotal = watchItems.reduce((acc, item) => {
    const quantity = new Decimal(item.quantity || 0);
    const price = new Decimal(item.unitPrice || 0);
    let lineTotal = quantity.times(price);

    if (item.discountPercent != null && item.discountPercent > 0) {
      const discountMultiplier = new Decimal(1).minus(
        new Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.times(discountMultiplier);
    } else if (item.discountAmount != null && item.discountAmount > 0) {
      const discount = new Decimal(item.discountAmount);
      lineTotal = lineTotal.minus(discount).greaterThan(0) ? lineTotal.minus(discount) : new Decimal(0);
    }

    return acc.plus(lineTotal);
  }, new Decimal(0));

  const totalVat = watchItems.reduce((acc, item) => {
    if (watchVatReverseCharge) return acc;

    const quantity = new Decimal(item.quantity || 0);
    const price = new Decimal(item.unitPrice || 0);
    const vatRate = new Decimal(item.vatRatePercent || 0);
    let lineTotal = quantity.times(price);

    if (item.discountPercent != null && item.discountPercent > 0) {
      const discountMultiplier = new Decimal(1).minus(
        new Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.times(discountMultiplier);
    } else if (item.discountAmount != null && item.discountAmount > 0) {
      const discount = new Decimal(item.discountAmount);
      lineTotal = lineTotal.minus(discount).greaterThan(0) ? lineTotal.minus(discount) : new Decimal(0);
    }

    const lineVat = lineTotal.times(vatRate.div(100));
    return acc.plus(lineVat);
  }, new Decimal(0));

  const grandTotal = subTotal.plus(totalVat);

  const calculateLineTotal = (item: InvoiceFormValues['items'][number]): number => {
    const quantity = new Decimal(item.quantity || 0);
    const price = new Decimal(item.unitPrice || 0);
    let lineTotal = quantity.times(price);

    if (item.discountPercent != null && item.discountPercent > 0) {
      const discountMultiplier = new Decimal(1).minus(
        new Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.times(discountMultiplier);
    } else if (item.discountAmount != null && item.discountAmount > 0) {
      const discount = new Decimal(item.discountAmount);
      lineTotal = lineTotal.minus(discount).greaterThanOrEqualTo(0) ? lineTotal.minus(discount) : new Decimal(0);
    }
    return lineTotal.toDP(2).toNumber();
  };

  const title = isEditMode ? "Edit Invoice" : "Create New Invoice";

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => {
                    const customerOptions = initialCustomers.map(customer => ({
                      value: customer.id,
                      label: customer.name
                    }));
                    
                    return (
                      <FormItem className="col-span-2 md:col-span-2">
                        <FormLabel>Customer *</FormLabel>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ComboboxResponsive
                              options={customerOptions}
                              selectedValue={field.value || ''}
                              onSelectedValueChange={field.onChange}
                              placeholder="Select a customer..."
                              searchPlaceholder="Search customers..."
                              disabled={isEditMode || createInvoiceMutation.isPending}
                            />
                          </div>
                          <Button 
                            type="button" 
                            onClick={() => setIsAddCustomerDialogOpen(true)} 
                            variant="outline" 
                            size="sm" 
                            className="ml-2"
                            disabled={createInvoiceMutation.isPending}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Invoice Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={createInvoiceMutation.isPending}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01") || createInvoiceMutation.isPending}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={createInvoiceMutation.isPending}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date: Date) => date < (form.getValues("invoiceDate") || new Date("1900-01-01")) || createInvoiceMutation.isPending}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Payment Terms Dropdown */}
                <FormField
                  control={form.control}
                  name="paymentTermsDays"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Terms</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          const numValue = parseInt(value);
                          field.onChange(numValue);
                          // Auto-calculate due date based on payment terms
                          const invoiceDate = form.getValues("invoiceDate");
                          if (invoiceDate && value !== "custom") {
                            const days = parseInt(value);
                            const dueDate = new Date(invoiceDate);
                            dueDate.setDate(dueDate.getDate() + days);
                            form.setValue("dueDate", dueDate);
                          }
                        }} 
                        value={field.value?.toString()} 
                        disabled={createInvoiceMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="custom">Custom due date</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Items *</FormLabel>
                <div className="border rounded-md overflow-x-auto">
                  <Table className="min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Item</TableHead>
                        <TableHead className="min-w-[180px]">Description</TableHead>
                        <TableHead className="w-[100px]">Qty</TableHead>
                        <TableHead className="w-[120px]">Unit Price</TableHead>
                        <TableHead className="w-[90px]">VAT %</TableHead>
                        <TableHead className="w-[130px]">Disc %</TableHead>
                        <TableHead className="w-[130px]">Disc Amt</TableHead>
                        <TableHead className="w-[140px] text-right">Line Total</TableHead>
                        <TableHead className="w-[60px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const itemValue = watchItems[index];
                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.itemId`}
                              render={({ field }) => (
                                <FormItem>
                                                                     <ComboboxResponsive
                                     onSelectedValueChange={(value) => {
                                       field.onChange(value);
                                       handleItemChange(index, value);
                                     }}
                                     selectedValue={field.value}
                                     disabled={createInvoiceMutation.isPending}
                                     options={inventoryItems.map(i => ({
                                       value: i.id,
                                       label: `${i.name} (${i.sku})`,
                                     }))}
                                     placeholder="Select item..."
                                     searchPlaceholder="Search items..."
                                   />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl><Input {...field} value={field.value ?? ''} disabled={createInvoiceMutation.isPending} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="text" 
                                      placeholder="1,00"
                                      value={field.value !== null && field.value !== undefined ? formatNordicNumber(field.value, 2) : ''}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                          field.onChange(1);
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
                                          field.onChange(1);
                                        }
                                        field.onBlur();
                                      }}
                                      disabled={createInvoiceMutation.isPending} 
                                      className="text-right" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="text" 
                                      placeholder="0,00"
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
                                      disabled={createInvoiceMutation.isPending}
                                      className="text-right"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.vatRatePercent`}
                              render={({ field }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseFloat(value))}
                                    value={field.value?.toString()}
                                    disabled={createInvoiceMutation.isPending || watchVatReverseCharge}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="VAT %" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {FINNISH_VAT_RATES.map(rate => (
                                        <SelectItem key={rate} value={rate.toString()}>
                                          {rate}%
                                        </SelectItem>
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
                              control={form.control}
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
                                          form.setValue(`items.${index}.discountAmount`, null);
                                          return;
                                        }
                                        
                                        if (isValidNordicNumber(value)) {
                                          const numericValue = parseNordicNumber(value);
                                          if (!isNaN(numericValue)) {
                                            field.onChange(numericValue);
                                            
                                            // Auto-calculate discount amount when percent changes
                                            if (numericValue > 0) {
                                              const currentItem = form.getValues(`items.${index}`);
                                              const rowTotal = (currentItem.quantity || 0) * (currentItem.unitPrice || 0);
                                              const discountAmount = rowTotal * (numericValue / 100);
                                              form.setValue(`items.${index}.discountAmount`, discountAmount);
                                            } else {
                                              form.setValue(`items.${index}.discountAmount`, null);
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
                                      disabled={createInvoiceMutation.isPending}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
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
                                      disabled={createInvoiceMutation.isPending}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(calculateLineTotal(itemValue))}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={createInvoiceMutation.isPending || fields.length <= 1}>
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
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => append({ itemId: "", description: "", quantity: 1, unitPrice: 0, vatRatePercent: 24, discountAmount: null, discountPercent: null })}
                  disabled={createInvoiceMutation.isPending}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
                {form.formState.errors.items && !Array.isArray(form.formState.errors.items) && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.items.message}</p>
                )}
              </div>

              <div className="flex justify-end pt-6">
                <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subTotal.toNumber())}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>VAT</span>
                        <span>{formatCurrency(totalVat.toNumber())}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(grandTotal.toNumber())}</span>
                    </div>
                </div>
              </div>

              {/* Margin Calculation Card */}
              <MarginCalculationCard
                items={form.watch("items")?.map(item => {
                  const invItem = inventoryItems.find(inv => inv.id === item.itemId);
                  if (!invItem) {
                    console.warn(`Inventory item not found for ID: ${item.itemId}`);
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
                customerId={form.watch("customerId")}
                showCalculateButton={true}
                className="mt-6"
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes for the invoice..."
                        className="resize-none"
                        {...field}
                        value={field.value ?? ''}
                        disabled={createInvoiceMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatReverseCharge"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox 
                        checked={field.value} 
                        onCheckedChange={(checked) => {
                          const newCheckedState = !!checked;
                          field.onChange(newCheckedState);
                          form.setValue('vatReverseCharge', newCheckedState, { shouldValidate: true });

                          if (newCheckedState) {
                            watchItems.forEach((_, index) => {
                              form.setValue(`items.${index}.vatRatePercent`, 0);
                            });
                          } else {
                            // Optional: Revert VAT rates if unchecking reverse charge, e.g., to default 24%
                            // This depends on desired UX.
                            // watchItems.forEach((_, index) => {
                            //   form.setValue(`items.${index}.vatRatePercent`, 24);
                            // });
                          }
                        }}
                        disabled={createInvoiceMutation.isPending} 
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>VAT Reverse Charge</FormLabel>
                      <FormDescription>
                        Enable for reverse charge VAT (e.g., intra-EU B2B). Sets 0% VAT on all items.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={createInvoiceMutation.isPending} className="mr-2">
                Cancel
              </Button>
              {isEditMode && (
                <Button type="button" className="mr-2" onClick={() => setShowSendModal(true)}>
                  Send Invoice
                </Button>
              )}
              <Button 
                type="submit" 
                variant="secondary"
                disabled={
                  (!isEditMode && createInvoiceMutation.isPending) || 
                  (!form.formState.isValid && form.formState.isSubmitted)
                }
              >
                {isEditMode ? "Save Draft" : (createInvoiceMutation.isPending ? "Creating..." : "Create Invoice")}
              </Button>
            </CardFooter>
            {/* Send Confirmation Modal */}
            <SendConfirmationModal
              target="invoice"
              open={showSendModal}
              onOpenChange={setShowSendModal}
              onConfirm={async (method) => {
                try {
                  if (method === 'email-pdf' && editInvoiceData) {
                    const { sendInvoiceEmail } = await import("@/lib/services/send.service");
                    await sendInvoiceEmail({
                      invoiceId: editInvoiceData.id,
                      method: method,
                    });
                    toast.success('Invoice sent successfully!');
                  } else {
                    toast.info(`Sending via ${method} - functionality coming soon`);
                  }
                } catch (error) {
                  console.error('Error sending invoice:', error);
                  toast.error('Failed to send invoice. Please try again.');
                }
                setShowSendModal(false);
              }}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="ourReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Our Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Your reference for this invoice" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer's number" {...field} value={field.value ?? ''} readOnly />
                    </FormControl>
                     <FormDescription>Auto-filled when customer is selected.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Method</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Postipaketti" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="complaintPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complaint Period</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 7 vrk" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="penaltyInterest"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Penalty Interest (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        placeholder="e.g., 10,5" 
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
                          } else {
                            // Allow typing but don't update the form value with invalid input
                            // This allows the user to type intermediate states like "10," before "10,5"
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value !== '' && !isValidNordicNumber(value)) {
                            // Clear invalid value on blur
                            field.onChange(null);
                          }
                          field.onBlur();
                        }}
                        disabled={createInvoiceMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>

      <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm 
            onSuccessCallback={(createdCustomerId) => {
              if (createdCustomerId) {
                form.setValue("customerId", createdCustomerId, { shouldValidate: true });
                utils.customer.list.invalidate().then(() => {
                });
              }
              setIsAddCustomerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Invoice Submission Modal */}
      {createdInvoice && (
        <InvoiceSubmissionModal
          isOpen={showSubmissionModal}
          onOpenChange={setShowSubmissionModal}
          invoiceId={createdInvoice.id}
          invoiceNumber={createdInvoice.invoiceNumber}
        />
      )}
    </>
  );
} 