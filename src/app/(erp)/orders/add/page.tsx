import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Use hooks
import { api } from "@/lib/trpc/react"; // Import tRPC hooks
import OrderForm from '@/components/orders/OrderForm';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from "@/lib/auth"; // Use correct export
import { prisma } from '@/lib/db';

// Removed unused imports: prisma, MaterialType

// Fetch data required for the form (customers, inventory)
async function getFormData() {
  // Fetch customers (only need id and name for select)
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch inventory items (id, name, price, unit for select and auto-price)
  const inventoryItems = await prisma.inventoryItem.findMany({
    select: {
        id: true,
        name: true,
        salesPrice: true,
        unitOfMeasure: true,
        sku: true // Added sku to the selection
    },
    orderBy: { name: 'asc' },
  });

  return { customers, inventoryItems };
}

// Loading component for Suspense boundary
function OrderFormSkeleton() {
    return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-8 w-1/4" />
            <div className="border rounded-md p-4">
                <Skeleton className="h-6 w-1/5 mb-2" />
                <Skeleton className="h-10 w-full mb-4" />
                <Skeleton className="h-6 w-1/5 mb-2" />
                <Skeleton className="h-20 w-full mb-4" />
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

// Add Order Page Component (Server Component)
// NOTE: This component MUST remain a Server Component (no 'use client') 
// because it uses async/await for data fetching (getFormData, getServerAuthSession).
// Data is passed as props (or promise) down to Client Components via the wrapper.
export default async function AddOrderPage() {
  const session = await getServerAuthSession(); // Call the correct function
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  // Fetch data in the Server Component
  const formDataPromise = getFormData();

  return (
    <div className="container mx-auto py-8">
       <Suspense fallback={<OrderFormSkeleton />}>
         {/* Await data inside Suspense boundary */}
          <AddOrderFormWrapper formDataPromise={formDataPromise} />
       </Suspense>
    </div>
  );
}

// Wrapper component to handle awaited promise inside Suspense
async function AddOrderFormWrapper({ formDataPromise }: { formDataPromise: ReturnType<typeof getFormData> }) {
    const { customers, inventoryItems: rawInventoryItems } = await formDataPromise;

    const processedInventoryItems = rawInventoryItems.map(item => ({
      ...item,
      salesPrice: item.salesPrice.toNumber(), // Convert Decimal to number
      unitOfMeasure: item.unitOfMeasure ?? '', // Provide default for null unitOfMeasure
      sku: item.sku ?? '' // Provide default empty string for null SKU
    }));

    return (
        <OrderForm
            customers={customers}
            inventoryItems={processedInventoryItems} // Pass processed items
            isEditMode={false}
        />
    );
} 