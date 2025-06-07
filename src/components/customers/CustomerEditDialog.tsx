"use client";

import * as React from "react";
import { type Customer, type Address } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { CustomerForm } from "./CustomerForm";
import { api } from "@/lib/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-toastify";

interface CustomerEditDialogProps {
  customerId: string;
  trigger?: React.ReactNode; // Allow custom trigger
  onSuccess?: () => void; // Callback on successful update
}

export function CustomerEditDialog({ customerId, trigger, onSuccess }: CustomerEditDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Fetch customer data when the dialog is about to open
  const { data: customerData, isLoading, error, refetch } = api.customer.getById.useQuery(
    { id: customerId },
    { enabled: isOpen } // Only fetch when dialog is open (or about to open)
  );

  React.useEffect(() => {
    if (isOpen) {
      refetch(); // Refetch when dialog opens to ensure fresh data
    }
  }, [isOpen, refetch]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset or cleanup if needed when dialog closes
    }
  };
  
  const handleSuccess = () => {
    setIsOpen(false); // Close dialog on success
    if (onSuccess) {
      onSuccess(); // Call parent onSuccess callback (e.g., to refresh list)
    }
  }

  if (error) {
    // This should ideally not happen if customerId is valid and user has perms
    // For robustness, you could show a toast or a small error message
    // and prevent the dialog from fully rendering the form.
    console.error("Error fetching customer data:", error);
    toast.error(`Failed to load customer data: ${error.message}`);
    // Don't render the dialog trigger if data fetch failed critically, or provide a disabled trigger
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Edit Customer</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update the customer&apos;s details below. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        {
          isLoading && isOpen && (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/4 ml-auto" />
            </div>
          )
        }
        {
          !isLoading && !error && customerData && isOpen && (
            <CustomerForm 
              initialData={customerData as Customer & { addresses: Address[] }} 
              onSuccessCallback={handleSuccess} // Pass callback to CustomerForm
            />
          )
        }
        {/* Footer can be part of CustomerForm or here if needed */}
        {/* Example of explicit close, though form submission should handle it */}
        {/* <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
} 