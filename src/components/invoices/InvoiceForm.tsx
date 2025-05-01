"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { type Customer, type InventoryItem, InvoiceStatus } from "@prisma/client";
import { Decimal } from '@prisma/client/runtime/library';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

import { CreateInvoiceSchema, type CreateInvoiceInput } from "@/lib/schemas/invoice.schema";
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
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";

type InvoiceFormProps = {
  customers: Pick<Customer, 'id' | 'name'>[];
  inventoryItems: Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure' | 'sku'>[];
  isEditMode?: boolean;
};

type InventoryItemFormData = Pick<InventoryItem, 'id' | 'name' | 'salesPrice' | 'unitOfMeasure' | 'sku'>;

export default function InvoiceForm({ customers, inventoryItems, isEditMode = false }: InvoiceFormProps) {
  const router = useRouter();
  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(CreateInvoiceSchema),
    defaultValues: {
      customerId: "",
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      notes: "",
      items: [{ itemId: "", quantity: 1, unitPrice: 0, vatRatePercent: 0, description: "" }],
      orderId: null,
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

  function onSubmit(values: CreateInvoiceInput) {
    console.log("Form submitted:", values);
    if (isEditMode) {
      toast.info("Update functionality not yet implemented.");
    } else {
      createInvoiceMutation.mutate(values);
    }
  }

  const handleItemChange = (index: number, itemId: string) => {
    const selectedItem = inventoryItems.find(item => item.id === itemId) as InventoryItemFormData | undefined;
    if (selectedItem) {
      form.setValue(`items.${index}.description`, selectedItem.name ?? '', { shouldValidate: true });
      form.setValue(`items.${index}.unitPrice`, selectedItem.salesPrice ? Number(selectedItem.salesPrice) : 0, { shouldValidate: true });
    }
  };

  const watchItems = form.watch("items");
  const subTotal = watchItems.reduce((acc, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return acc + quantity * price;
  }, 0);
  const totalVat = watchItems.reduce((acc, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const vatRate = Number(item.vatRatePercent) || 0;
    return acc + (quantity * price * vatRate / 100);
  }, 0);
  const grandTotal = subTotal + totalVat;

  const title = isEditMode ? "Edit Invoice" : "Create New Invoice";
  const isPending = createInvoiceMutation.isPending;

  return (
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
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isEditMode || isPending}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                            disabled={isPending}
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
                          disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01") || isPending}
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
                            disabled={isPending}
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
                          disabled={(date: Date) => date < (form.getValues("invoiceDate") || new Date("1900-01-01")) || isPending}
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
                    <TableHead className="w-[25%]">Item</TableHead>
                    <TableHead className="w-[30%]">Description</TableHead>
                    <TableHead className="w-[10%]">Qty</TableHead>
                    <TableHead className="w-[15%] text-right">Unit Price</TableHead>
                    <TableHead className="w-[10%] text-right">VAT %</TableHead>
                    <TableHead className="w-[10%] text-right">Total</TableHead>
                    <TableHead className="w-auto"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const itemValue = watchItems[index];
                    const quantity = Number(itemValue?.quantity) || 0;
                    const unitPrice = Number(itemValue?.unitPrice) || 0;
                    const lineTotal = quantity * unitPrice;
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.itemId`}
                            render={({ field: itemField }) => (
                              <FormItem>
                                <Select 
                                  onValueChange={(value) => {
                                    itemField.onChange(value);
                                    handleItemChange(index, value);
                                  }}
                                  defaultValue={itemField.value}
                                  disabled={isPending}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select item" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {inventoryItems.map(i => (
                                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku})</SelectItem>
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
                            name={`items.${index}.description`}
                            render={({ field: descField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...descField} placeholder="Item description" disabled={isPending} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                         <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field: qtyField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number"
                                    step="any" 
                                    {...qtyField} 
                                    onChange={e => qtyField.onChange(parseFloat(e.target.value) || 0)}
                                    placeholder="Qty" 
                                    disabled={isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field: priceField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    {...priceField} 
                                    onChange={e => priceField.onChange(parseFloat(e.target.value) || 0)}
                                    placeholder="Price" 
                                    className="text-right" 
                                    disabled={isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                         <TableCell className="text-right">
                          <FormField
                            control={form.control}
                            name={`items.${index}.vatRatePercent`}
                            render={({ field: vatField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    {...vatField}
                                    onChange={e => vatField.onChange(parseFloat(e.target.value) || 0)}
                                    placeholder="VAT %" 
                                    className="text-right" 
                                    disabled={isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">{lineTotal.toFixed(2)}</TableCell>
                        <TableCell>
                           <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => remove(index)} 
                              disabled={fields.length <= 1 || isPending}
                           >
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
                onClick={() => append({ itemId: "", quantity: 1, unitPrice: 0, vatRatePercent: 0, description: "" })}
                disabled={isPending}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
              {form.formState.errors.items?.root && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2 flex justify-end">
              <div className="w-full md:w-1/3 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total VAT:</span>
                  <span>{totalVat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Grand Total:</span>
                  <span>{grandTotal.toFixed(2)}</span>
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
                        placeholder="Add any internal notes or payment terms here..."
                        className="resize-none"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : (isEditMode ? "Save Changes" : "Create Invoice")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
} 