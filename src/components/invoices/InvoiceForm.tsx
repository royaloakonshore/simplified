"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { type Customer, type InventoryItem } from "@prisma/client";
import Decimal from 'decimal.js';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import React from 'react';

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

type InvoiceFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure' | 'sku'>[];
  isEditMode?: boolean;
};

type InventoryItemFormData = Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure' | 'sku'>;

export default function InvoiceForm({ customers: initialCustomers, inventoryItems, isEditMode = false }: InvoiceFormProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = React.useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormValidationSchema),
    defaultValues: {
      customerId: "",
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      notes: "",
      items: [{ 
        itemId: "",
        description: "",
        quantity: 1, 
        unitPrice: 0, 
        vatRatePercent: FINNISH_VAT_RATES[0],
        discountAmount: null, 
        discountPercent: null 
      }],
      orderId: undefined,
      vatReverseCharge: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createInvoiceMutation = api.invoice.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice ${data.invoiceNumber} created successfully!`);
      router.push(`/invoices/${data.id}`);
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

  const onSubmit: SubmitHandler<InvoiceFormValues> = (values) => {
    console.log("Form submitted (InvoiceFormValues):", values);

    const transformedForApi: CreateInvoiceInput = {
      customerId: values.customerId,
      invoiceDate: values.invoiceDate,
      dueDate: values.dueDate,
      notes: values.notes ?? undefined,
      items: values.items.map(item => ({
        ...(item.id && { id: item.id }),
        itemId: item.itemId,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRatePercent: Number(item.vatRatePercent),
        discountAmount: item.discountAmount ? Number(item.discountAmount) : null,
        discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
      })),
      orderId: values.orderId ?? undefined,
      vatReverseCharge: values.vatReverseCharge ?? false,
    };

    console.log("Transformed for API (CreateInvoiceInput shape):", transformedForApi);

    try {
      const validatedApiInput = CreateInvoiceSchema.parse(transformedForApi);
      console.log("Validated API Input:", validatedApiInput);

      if (isEditMode) {
        toast.info("Update functionality not yet implemented.");
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
      form.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice ? Number(selectedItem.salesPrice) : 0, { shouldValidate: true });
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
                  render={({ field }) => (
                    <FormItem className="col-span-2 md:col-span-2">
                      <FormLabel>Customer *</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isEditMode || createInvoiceMutation.isPending}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {initialCustomers.map(c => (
                              <SelectItem value={c.id} key={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  )}
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
              </div>

              <div>
                <FormLabel>Items *</FormLabel>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[100px]">VAT %</TableHead>
                      <TableHead className="w-[120px]">Discount %</TableHead>
                      <TableHead className="w-[120px]">Discount Amt.</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-[50px]">Actions</TableHead>
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
                                  <Select onValueChange={(value) => { field.onChange(value); handleItemChange(index, value); }} defaultValue={field.value} disabled={createInvoiceMutation.isPending}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger></FormControl>
                                    <SelectContent>{inventoryItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku})</SelectItem>)}</SelectContent>
                                  </Select>
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
                                  <FormControl><Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={createInvoiceMutation.isPending} className="text-right" /></FormControl>
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
                                      type="number" 
                                      step="0.01" 
                                      {...field} 
                                      onChange={e => field.onChange(parseFloat(e.target.value))} 
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
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                                      placeholder="e.g. 10"
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
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                                      placeholder="e.g. 5.00"
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
              <Button 
                type="submit" 
                disabled={
                  (isEditMode && false) || // Placeholder for updateInvoiceMutation.isLoading
                  (!isEditMode && createInvoiceMutation.isPending) || 
                  (!form.formState.isValid && form.formState.isSubmitted) 
                }
              >
                {
                  isEditMode 
                    ? (false ? "Updating..." : "Update Invoice") // Placeholder for updateInvoiceMutation.isLoading
                    : (createInvoiceMutation.isPending ? "Creating..." : "Create Invoice")
                }
              </Button>
            </CardFooter>
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
    </>
  );
} 