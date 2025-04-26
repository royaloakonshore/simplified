'use client';

import * as React from "react";
import { useParams } from 'next/navigation';
import { api } from "@/lib/trpc/react";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default function EditCustomerPage() {
  const params = useParams();
  const customerId = params?.id as string; // Type assertion

  const { data: customer, isLoading, error } = api.customer.getById.useQuery(
    { id: customerId },
    {
      enabled: !!customerId, // Only run query if customerId is available
    }
  );

  if (isLoading) {
    // TODO: Add Skeleton Loader
    return <div>Loading customer data...</div>;
  }

  if (error) {
    return <div>Error loading customer: {error.message}</div>;
  }

  if (!customer) {
    return <div>Customer not found.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Edit Customer: {customer.name}</h1>
      <CustomerForm initialData={customer} />
    </div>
  );
} 