"use client"; // Or remove if it's a Server Component

import React from 'react';
import { CustomerForm } from "@/components/customers/CustomerForm";
// import { BreadcrumbItem, Breadcrumbs } from "@/components/layout/Breadcrumbs"; // Assuming Breadcrumbs is used for navigation context

export default function AddCustomerPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* Optional: Add breadcrumbs for navigation context if your layout doesn't handle it for 'add' pages */}
      {/* 
      <Breadcrumbs className="mb-4">
        <BreadcrumbItem href="/customers">Customers</BreadcrumbItem>
        <BreadcrumbItem currentPage>Add New Customer</BreadcrumbItem>
      </Breadcrumbs> 
      */}
      
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Add New Customer</h1>
        <CustomerForm />
      </div>
    </div>
  );
} 