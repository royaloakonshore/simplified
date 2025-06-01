import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

// Import the new loader component and its skeleton
import EditOrderFormLoader, { OrderFormSkeleton } from '@/components/orders/EditOrderFormLoader';

// Define the expected prop types for Next.js 15
type PageRouteParams = { id: string };
type PageSearchParams = { [key: string]: string | string[] | undefined };

type Props = {
  params: Promise<PageRouteParams>;
  searchParams: Promise<PageSearchParams>; // searchParams should also be a Promise
};

export default async function EditOrderPage({ params: paramsPromise, searchParams: searchParamsPromise }: Props) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;

  if (!params.id) {
      notFound();
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