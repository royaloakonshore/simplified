import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from "@/lib/auth"; // Use correct export
import { prisma } from '@/lib/db';
import { Skeleton } from "@/components/ui/skeleton"; // For fallback
import InvoiceForm from '@/components/invoices/InvoiceForm'; // Placeholder form component

// Fetch data required for the form (initially just customers)
async function getFormData() {
  // Fetch customers (only need id and name for select)
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch inventory items (might be needed later)
  const inventoryItems = await prisma.inventoryItem.findMany({
      select: {
          id: true,
          name: true,
          salesPrice: true, // Use salesPrice for invoices
          unitOfMeasure: true
      },
      orderBy: { name: 'asc' },
    });


  return { customers, inventoryItems }; // Adjust as needed
}

// Loading component for Suspense boundary
function InvoiceFormSkeleton() {
    // Basic skeleton, adapt as needed
    return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-8 w-1/4" />
            <div className="border rounded-md p-4 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-6 w-1/5 mb-2" />
                 <div className="flex space-x-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-16" />
                 </div>
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-10 w-28" />
            </div>
        </div>
    );
}

// Add this line to force dynamic rendering if needed, otherwise rely on data fetching
// export const dynamic = 'force-dynamic';

// Add Invoice Page Component (Server Component)
export default async function AddInvoicePage() {
  const session = await getServerAuthSession(); // Call the correct function
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  // Fetch data in the Server Component
  const formDataPromise = getFormData();

  return (
    <div className="container mx-auto py-8">
       <Suspense fallback={<InvoiceFormSkeleton />}>
         {/* Await data inside Suspense boundary */}
          <AddInvoiceFormWrapper formDataPromise={formDataPromise} />
       </Suspense>
    </div>
  );
}

// Wrapper component to handle awaited promise inside Suspense
async function AddInvoiceFormWrapper({ formDataPromise }: { formDataPromise: ReturnType<typeof getFormData> }) {
    const { customers, inventoryItems } = await formDataPromise;

    // Render the actual form component, passing the fetched data
    return (
        <InvoiceForm
            customers={customers}
            inventoryItems={inventoryItems}
            // Pass other necessary props
            isEditMode={false} // Explicitly set to false for creation
        />
    );
} 