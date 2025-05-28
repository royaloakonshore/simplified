'use client';

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { customerBaseSchema, yTunnusSchema } from "@/lib/schemas/customer.schema";
import { Trash2, Plus, Search, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // For visual separation

// Define the form schema type based on the base schema
type CustomerFormData = z.infer<typeof customerBaseSchema>;

interface CustomerFormProps {
  initialData?: Customer & { addresses: Address[] }; // Optional initial data for editing
  onSuccessCallback?: (createdCustomerId?: string) => void; // Modified to accept optional customer ID
}

export function CustomerForm({ initialData, onSuccessCallback }: CustomerFormProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [yTunnusSearch, setYTunnusSearch] = React.useState("");

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

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  const { 
    data: prhData,
    refetch: fetchPrhData,
    isLoading: isPrhLoading,
  } = api.customer.getYTunnusInfo.useQuery(
    { yTunnus: yTunnusSearch }, 
    { 
      enabled: false, // Only call on demand
      retry: false, // Don't retry on error for this manual call
    }
  );

  const handleYTunnusSearch = async () => {
    try {
      yTunnusSchema.parse(yTunnusSearch); // Validate format before fetching
      const result = await fetchPrhData(); // fetchPrhData returns a promise

      if (result.data) {
        const data = result.data;
        toast.success(`Company data fetched for ${data.name}`);
        form.setValue("name", data.name);
        if (data.vatId) {
          form.setValue("vatId", data.vatId);
        }

        const addressToUpdate = {
          type: AddressType.billing, 
          streetAddress: data.streetAddress || '' ,
          city: data.city || '' ,
          postalCode: data.postalCode || '' ,
          countryCode: data.countryCode || 'FI',
        };

        if (fields.length > 0) {
          const firstAddressCurrentData = fields[0];
          update(0, { ...firstAddressCurrentData, ...addressToUpdate });
        } else {
          append(addressToUpdate);
        }
      } else if (result.error) {
        toast.error(`Failed to fetch Y-tunnus info: ${result.error.message}`);
      }

    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0]?.message || "Invalid Y-tunnus format.");
      } else {
        toast.error("An unexpected error occurred during Y-tunnus search.");
        console.error("YTunnus search error:", e);
      }
    }
  };

  const createCustomer = api.customer.create.useMutation({
    onSuccess: (data) => { // data is the created customer, contains id
      toast.success('Customer created successfully!');
      utils.customer.list.invalidate();
      if (onSuccessCallback) {
        onSuccessCallback(data.id); // Pass the new customer's ID
      } else {
        router.push('/customers');
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Y-tunnus Search</CardTitle>
            <CardDescription>
              Search for company details using Finnish Business ID (Y-tunnus) to auto-fill information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Input 
                id="yTunnusSearchInput"
                placeholder="1234567-8"
                value={yTunnusSearch}
                onChange={(e) => setYTunnusSearch(e.target.value)}
                className="max-w-xs"
                disabled={isPrhLoading}
              />
              <Button 
                type="button" 
                onClick={handleYTunnusSearch} 
                disabled={isPrhLoading || !yTunnusSearch.trim()}
              >
                {isPrhLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" /> 
                )}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Customer Details</CardTitle>
                <CardDescription>Basic information about the customer.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Addresses</CardTitle>
                <CardDescription>Manage customer billing and shipping addresses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-md space-y-4 relative bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-md">Address {index + 1}</h3>
                        <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                        >
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <Separator className="mb-4"/>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name={`addresses.${index}.type`}
                            render={({ field: selectField }) => (
                            <FormItem>
                                <FormLabel>Type*</FormLabel>
                                <Select onValueChange={selectField.onChange} defaultValue={selectField.value}>
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
                    className="mt-2"
                    >
                    <Plus className="mr-2 h-4 w-4" /> Add Address
                </Button>
            </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={createCustomer.isLoading || updateCustomer.isLoading}>
            {initialData ? 'Update Customer' : 'Create Customer'}
            </Button>
        </div>
      </form>
    </Form>
  );
} 