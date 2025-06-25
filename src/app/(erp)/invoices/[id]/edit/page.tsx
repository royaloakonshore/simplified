import { Suspense } from 'react';
import { Metadata } from 'next';
import { createAppCaller } from '@/lib/api/root';
import { createTRPCContext } from '@/lib/api/trpc';
import { notFound } from 'next/navigation';
import InvoiceForm from '@/components/invoices/InvoiceForm';
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Edit Invoice',
};

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

async function EditInvoiceContent({ invoiceId }: { invoiceId: string }) {
  try {
    // Create server-side caller
    const context = await createTRPCContext({ headers: await headers() });
    const api = createAppCaller(context);
    
    // Fetch the invoice data
    const invoice = await api.invoice.get({ id: invoiceId });
    
    if (!invoice) {
      notFound();
    }

    // Fetch necessary data for the form
    const [customers, inventoryItems] = await Promise.all([
      api.customer.list({ perPage: 100 }),
      api.inventory.list({ perPage: 100 })
    ]);

    return (
      <div className="w-full space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Invoice</h1>
            <p className="text-muted-foreground">
              Update invoice {invoice.invoiceNumber}
            </p>
          </div>
        </div>
        
        <div className="border-b" />
        
        <InvoiceForm 
          customers={customers.items}
          inventoryItems={inventoryItems.data.map(item => ({
            id: item.id,
            name: item.name,
            salesPrice: parseFloat(item.salesPrice),
            unitOfMeasure: item.unitOfMeasure || '',
            sku: item.sku || ''
          }))}
          isEditMode={true}
          editInvoiceData={invoice}
        />
      </div>
    );
  } catch (error) {
    console.error('Error loading invoice for edit:', error);
    notFound();
  }
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<DataTableSkeleton columnCount={4} rowCount={8} />}>
      <EditInvoiceContent invoiceId={id} />
    </Suspense>
  );
} 