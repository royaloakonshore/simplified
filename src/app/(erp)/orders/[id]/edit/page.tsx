import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

// Import the new loader component and its skeleton
import EditOrderFormLoader, { OrderFormSkeleton } from '@/components/orders/EditOrderFormLoader';

// Define the expected props type for a dynamic route page
type Props = {
  params: { id: string }; // params should be an object
  searchParams: { [key: string]: string | string[] | undefined }; // searchParams should be an object
};

// Component function signature might also need adjustment if it was awaiting these props
// export default async function EditOrderPage({ params: paramsPromise, searchParams: searchParamsPromise }: Props) {
// const params = await paramsPromise;
// const searchParams = await searchParamsPromise;

export default async function EditOrderPage({ params, searchParams }: Props) {
  if (!params.id) {
      notFound(); // Keep basic validation
  }

  return (
    <div className="container mx-auto py-8">
       <Suspense fallback={<OrderFormSkeleton />}>
          {/* Render the loader component */}
          <EditOrderFormLoader orderId={params.id} /> 
       </Suspense>
    </div>
    );
} 