import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

// Import the new loader component and its skeleton
import EditOrderFormLoader, { OrderFormSkeleton } from '@/components/orders/EditOrderFormLoader';

// Define the expected props type for a dynamic route page
type Props = {
  params: Promise<{ id: string }>; // params is now a Promise
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>; // searchParams is also a Promise
};

// Use the defined Props type - make component async
export default async function EditOrderPage({ params, searchParams }: Props) {
  // Await params before accessing its properties
  const resolvedParams = await params;
  const orderId = resolvedParams.id;
  // You would also await searchParams if you were using it:
  // const resolvedSearchParams = await searchParams;

  if (!orderId) {
      notFound(); // Keep basic validation
  }

  return (
    <div className="container mx-auto py-8">
       <Suspense fallback={<OrderFormSkeleton />}>
          {/* Render the loader component */}
          <EditOrderFormLoader orderId={orderId} /> 
       </Suspense>
    </div>
    );
} 