'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from "@/lib/trpc/react";
import InvoiceDetail from '@/components/invoices/InvoiceDetail';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { useBreadcrumbs, type BreadcrumbSegment } from '@/contexts/BreadcrumbContext';
// Prisma types might still be needed if api.invoice.get.useQuery infers a very generic type
// For now, assume InvoiceDetail's prop type is compatible with the direct API output.
// import type { Invoice as PrismaApiInvoice, Customer as PrismaApiCustomer, InvoiceItem as PrismaApiInvoiceItem, Order as PrismaApiOrder, Address as PrismaApiAddress, InventoryItem as PrismaApiInventoryItem } from '@prisma/client';
// import type { Decimal as PrismaApiDecimal } from '@prisma/client/runtime/library';

// Remove local type imports if no longer used for transformation
// import { type Invoice, type InvoiceItem, InvoiceStatus } from '@/lib/types/invoice.types';
// import { type Customer } from '@/lib/types/customer.types';
// import { type Order } from '@/lib/types/order.types';
// import { createUUID, createDecimal } from "@/lib/types/branded";


export default function InvoicePage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { setBreadcrumbSegments, clearBreadcrumbSegments } = useBreadcrumbs();

  const { data: invoiceDataFromApi, error, isLoading } = api.invoice.get.useQuery(
    { id: invoiceId },
    {
      enabled: !!invoiceId,
    }
  );

  useEffect(() => {
    if (invoiceDataFromApi) {
      const segments: BreadcrumbSegment[] = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Invoices', href: '/invoices' },
        { label: invoiceDataFromApi.invoiceNumber || invoiceId },
      ];
      setBreadcrumbSegments(segments);
    } else {
      clearBreadcrumbSegments();
    }

    return () => {
      clearBreadcrumbSegments();
    };
  }, [invoiceDataFromApi, invoiceId, setBreadcrumbSegments, clearBreadcrumbSegments]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !invoiceDataFromApi) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Invoice</AlertTitle>
          <AlertDescription>
            {error?.message || 'The requested invoice could not be found or loaded.'}
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/invoices">Return to Invoices</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No transformation needed, pass data directly
  // const mapApiCustomerToLocal = ... (removed)
  // const transformedInvoice = ... (removed)

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" asChild className="mr-4">
          <Link href="/invoices">← Back to Invoices</Link>
        </Button>
      </div>
      <Suspense fallback={<div>Loading invoice details...</div>}>
        {/* Pass the raw data from the API call */}
        <InvoiceDetail invoice={invoiceDataFromApi} /> 
        {/* 
          Casting to `as any` temporarily to bypass strict type checking.
          Ideally, `invoiceDataFromApi` should perfectly match the `FullInvoiceFromApi` 
          type expected by `InvoiceDetail` if tRPC's inference and Prisma types are aligned.
          If not, `FullInvoiceFromApi` in InvoiceDetail.tsx might need slight adjustments
          to exactly match the shape of `invoiceDataFromApi` (e.g. nullability of relations).
        */}
      </Suspense>
    </div>
  );
} 