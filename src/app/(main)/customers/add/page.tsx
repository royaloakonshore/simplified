'use client';

import * as React from "react";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default function AddCustomerPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Add New Customer</h1>
      <CustomerForm />
    </div>
  );
} 