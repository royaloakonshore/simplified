import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button'; // Assuming Shadcn Button
import InvoiceListContent from '@/components/invoices/InvoiceListContent'; // Placeholder for the client component
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton'; // Assuming a reusable skeleton
import { PageBanner } from '@/components/common/PageBanner';

export const metadata: Metadata = {
  title: 'Invoices',
};

// Ensure route is dynamically rendered
export const dynamic = 'force-dynamic';

export default function InvoicesPage() {
  return (
    <div className="w-full">
      <PageBanner 
        title="Invoices" 
        description="Manage your invoices and billing"
      >
        <Button asChild>
          <Link href="/invoices/add">Create Invoice</Link>
        </Button>
      </PageBanner>

      <div className="p-4 md:p-6">
        {/* TODO: Add Filter controls here */}

        <Suspense fallback={<DataTableSkeleton columnCount={6} rowCount={10} />}>
          <InvoiceListContent />
        </Suspense>
      </div>
    </div>
  );
} 