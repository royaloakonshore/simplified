"use client"; // Or remove if it's a Server Component

import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { CustomerForm } from "@/components/customers/CustomerForm";
// import { Heading } from "@/components/ui/heading"; // Removed
// import { Separator } from "@/components/ui/separator"; // Removed

export default function AddCustomerPage() {
  const router = useRouter();

  // Adjusted to match CustomerForm's expected signature: () => void
  const handleSuccess = () => { 
    // CustomerForm already shows a toast and invalidates list.
    // This callback is primarily for navigation after form's own success logic.
    toast.info("Redirecting to customer list..."); // Optional: give feedback about redirection
    router.push("/customers");
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        {/* Replaced Heading component with simple h1 */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Add New Customer</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the details to create a new customer.
          </p>
        </div>
      </div>
      {/* Replaced Separator component with a simple hr or div with border */}
      <div className="my-6 border-b" /> 
      <CustomerForm onSuccessCallback={handleSuccess} />
    </div>
  );
} 