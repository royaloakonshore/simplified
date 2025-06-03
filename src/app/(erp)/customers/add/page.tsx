"use client"; // Or remove if it's a Server Component

import { CustomerForm } from "@/components/customers/CustomerForm";

export default function AddCustomerPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Add New Customer</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the details to create a new customer.
          </p>
        </div>
      </div>
      <div className="my-6 border-b" /> 
      <CustomerForm />
    </div>
  );
} 