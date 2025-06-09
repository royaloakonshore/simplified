import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button'; // Assuming Shadcn Button
import InvoiceListContent from '@/components/invoices/InvoiceListContent'; // Placeholder for the client component
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton'; // Assuming a reusable skeleton

export const metadata: Metadata = {
  title: 'Invoices',
};

// Ensure route is dynamically rendered
export const dynamic = 'force-dynamic';

export default function InvoicesPage() {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/add">Create Invoice</Link>
        </Button>
      </div>

      {/* TODO: Add Filter controls here */}

      <Suspense fallback={<DataTableSkeleton columnCount={6} rowCount={10} />}>
        <InvoiceListContent />
      </Suspense>
    </div>
  );
} 