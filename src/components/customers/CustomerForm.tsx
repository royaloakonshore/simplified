'use client';

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type Customer, type Address, AddressType } from "@prisma/client";
import { z } from "zod";
import { useRouter } from "next/navigation";

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
import { Button } from "@/components/ui/button";
import { toast } from 'react-toastify'; // Assuming react-toastify is set up
import { api } from "@/lib/trpc/react";
import { customerBaseSchema } from "@/lib/schemas/customer.schema";
import { Trash2, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define the form schema type based on the base schema
type CustomerFormData = z.infer<typeof customerBaseSchema>;

interface CustomerFormProps {
  initialData?: Customer & { addresses: Address[] }; // Optional initial data for editing
  onSuccessCallback?: () => void; // Add callback for successful submission
}

export function CustomerForm({ initialData, onSuccessCallback }: CustomerFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerBaseSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          email: initialData.email ?? '',
          phone: initialData.phone ?? '',
          vatId: initialData.vatId ?? '',
          ovtIdentifier: initialData.ovtIdentifier ?? '',
          intermediatorAddress: initialData.intermediatorAddress ?? '',
          addresses: initialData.addresses ?? [],
        }
      : {
          name: '',
          email: '',
          phone: '',
          vatId: '',
          ovtIdentifier: '',
          intermediatorAddress: '',
          addresses: [{ type: AddressType.billing, streetAddress: '', city: '', postalCode: '', countryCode: 'FI' }], // Default with one billing address
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  const createCustomer = api.customer.create.useMutation({
    onSuccess: () => {
      toast.success('Customer created successfully!');
      utils.customer.list.invalidate(); // Invalidate list query to refetch
      if (onSuccessCallback) {
        onSuccessCallback();
      } else {
        router.push('/customers'); // Redirect to customer list
      }
    },
    onError: (error) => {
      toast.error(`Error creating customer: ${error.message}`);
    },
  });

  const updateCustomer = api.customer.update.useMutation({
    onSuccess: () => {
      toast.success('Customer updated successfully!');
      utils.customer.list.invalidate();
      if (initialData) {
          utils.customer.getById.invalidate({ id: initialData.id });
      }
      if (onSuccessCallback) {
        onSuccessCallback();
      } else {
        router.push('/customers');
      }
    },
    onError: (error) => {
      toast.error(`Error updating customer: ${error.message}`);
    },
  });

  function onSubmit(values: CustomerFormData) {
    if (initialData) {
      updateCustomer.mutate({ ...values, id: initialData.id });
    } else {
      createCustomer.mutate(values);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <h2 className="text-xl font-semibold">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Name*</FormLabel>
                <FormControl>
                    <Input placeholder="Customer Company Oy" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                    <Input type="email" placeholder="contact@customer.com" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                    <Input placeholder="+358 40 1234567" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="vatId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>VAT ID (Y-tunnus)</FormLabel>
                <FormControl>
                    <Input placeholder="1234567-8" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="ovtIdentifier"
            render={({ field }) => (
                <FormItem>
                <FormLabel>OVT/EDI Identifier</FormLabel>
                <FormControl>
                    <Input placeholder="003712345678" {...field} />
                </FormControl>
                 <FormDescription>Needed for Finvoice e-invoicing.</FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="intermediatorAddress"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Intermediator Address</FormLabel>
                <FormControl>
                    <Input placeholder="E.g., BANK" {...field} />
                </FormControl>
                 <FormDescription>E-invoice intermediator (optional).</FormDescription>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <h2 className="text-xl font-semibold">Addresses</h2>
        {fields.map((field, index) => (
          <div key={field.id} className="p-4 border rounded space-y-4 relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
              onClick={() => remove(index)}
              disabled={fields.length <= 1} // Prevent removing the last address
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name={`addresses.${index}.type`}
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Type*</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select address type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value={AddressType.billing}>Billing</SelectItem>
                                <SelectItem value={AddressType.shipping}>Shipping</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name={`addresses.${index}.streetAddress`}
                render={({ field }) => (
                    <FormItem className="md:col-span-2">
                    <FormLabel>Street Address*</FormLabel>
                    <FormControl>
                        <Input placeholder="Street Name 123" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                control={form.control}
                name={`addresses.${index}.postalCode`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Postal Code*</FormLabel>
                    <FormControl>
                        <Input placeholder="00100" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name={`addresses.${index}.city`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>City*</FormLabel>
                    <FormControl>
                        <Input placeholder="Helsinki" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name={`addresses.${index}.countryCode`}
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Country Code*</FormLabel>
                    <FormControl>
                        <Input placeholder="FI" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: AddressType.shipping, streetAddress: '', city: '', postalCode: '', countryCode: 'FI' })}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Address
        </Button>

        <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
          {initialData ? 'Update Customer' : 'Create Customer'}
        </Button>
      </form>
    </Form>
  );
} 