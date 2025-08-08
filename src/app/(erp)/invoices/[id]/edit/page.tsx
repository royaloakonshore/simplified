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
          inventoryItems={inventoryItems.items.map(item => ({
            id: item.id,
            name: item.name,
            salesPrice: parseFloat(item.salesPrice.toString()),
            costPrice: parseFloat(item.costPrice.toString()),
            itemType: item.itemType,
            unitOfMeasure: item.unitOfMeasure || '',
            sku: item.sku || '',
            bom: undefined, // BOM data not included in inventory.list, will be fetched separately if needed
          }))}
          isEditMode={true}
          editInvoiceData={{
            ...invoice,
            totalAmount: parseFloat(invoice.totalAmount.toString()),
            totalVatAmount: parseFloat(invoice.totalVatAmount.toString()),
             penaltyInterest: invoice.penaltyInterest != null ? parseFloat(invoice.penaltyInterest.toString()) : null,
            items: invoice.items.map((item: any) => ({
              ...item,
              quantity: item.quantity ? parseFloat(item.quantity.toString()) : 0,
              unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
              discountAmount: item.discountAmount ? parseFloat(item.discountAmount.toString()) : 0,
              discountPercentage: item.discountPercentage ? parseFloat(item.discountPercentage.toString()) : 0,
              vatRatePercent: item.vatRatePercent ? parseFloat(item.vatRatePercent.toString()) : 0,
              calculatedLineProfit: item.calculatedLineProfit ? parseFloat(item.calculatedLineProfit.toString()) : null,
              calculatedUnitCost: item.calculatedUnitCost ? parseFloat(item.calculatedUnitCost.toString()) : null,
              calculatedUnitProfit: item.calculatedUnitProfit ? parseFloat(item.calculatedUnitProfit.toString()) : null,
              inventoryItem: item.inventoryItem ? {
                ...item.inventoryItem,
                costPrice: parseFloat(item.inventoryItem.costPrice.toString()),
                salesPrice: parseFloat(item.inventoryItem.salesPrice.toString()),
                minimumStockLevel: parseFloat(item.inventoryItem.minimumStockLevel.toString()),
                reorderLevel: parseFloat(item.inventoryItem.reorderLevel.toString()),
                quantityOnHand: parseFloat(item.inventoryItem.quantityOnHand.toString()),
                defaultVatRatePercent: parseFloat(item.inventoryItem.defaultVatRatePercent.toString()),
                weight: item.inventoryItem.weight ? parseFloat(item.inventoryItem.weight.toString()) : null
              } : null
            })),
            order: invoice.order ? {
              ...invoice.order,
              totalAmount: parseFloat(invoice.order.totalAmount.toString()),
              items: invoice.order.items.map((orderItem: any) => ({
                ...orderItem,
                quantity: orderItem.quantity ? parseFloat(orderItem.quantity.toString()) : 0,
                unitPrice: orderItem.unitPrice ? parseFloat(orderItem.unitPrice.toString()) : 0,
                discountAmount: orderItem.discountAmount ? parseFloat(orderItem.discountAmount.toString()) : 0,
                discountPercentage: orderItem.discountPercentage ? parseFloat(orderItem.discountPercentage.toString()) : 0,
                vatRatePercent: orderItem.vatRatePercent ? parseFloat(orderItem.vatRatePercent.toString()) : 0,
                inventoryItem: orderItem.inventoryItem ? {
                  ...orderItem.inventoryItem,
                  costPrice: parseFloat(orderItem.inventoryItem.costPrice.toString()),
                  salesPrice: parseFloat(orderItem.inventoryItem.salesPrice.toString()),
                  minimumStockLevel: parseFloat(orderItem.inventoryItem.minimumStockLevel.toString()),
                  reorderLevel: parseFloat(orderItem.inventoryItem.reorderLevel.toString()),
                  quantityOnHand: parseFloat(orderItem.inventoryItem.quantityOnHand.toString()),
                  defaultVatRatePercent: parseFloat(orderItem.inventoryItem.defaultVatRatePercent.toString()),
                  weight: orderItem.inventoryItem.weight ? parseFloat(orderItem.inventoryItem.weight.toString()) : null
                } : null
              }))
            } : null
          }}
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