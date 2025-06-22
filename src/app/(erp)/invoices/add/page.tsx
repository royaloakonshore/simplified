import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerAuthSession } from "@/lib/auth"; // Use correct export
import { prisma } from '@/lib/db';
import { Skeleton } from "@/components/ui/skeleton"; // For fallback
import InvoiceForm from '@/components/invoices/InvoiceForm'; // Placeholder form component

// Update interface to include searchParams as Promise
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Fetch data required for the form (initially just customers)
async function getFormData(orderId?: string) {
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
          unitOfMeasure: true,
          sku: true, // Added sku field
      },
      orderBy: { name: 'asc' },
    });

  // Convert Decimal fields to numbers for client components (same pattern as OrderForm)
  const processedInventoryItems = inventoryItems.map(item => ({
    id: item.id,
    name: item.name,
    salesPrice: item.salesPrice.toNumber(), // Convert Decimal to number
    unitOfMeasure: item.unitOfMeasure ?? '', // Provide default for null unitOfMeasure
    sku: item.sku ?? '' // Provide default empty string for null SKU
  }));

  // If orderId is provided, fetch the order for prefilling
  let order = null;
  if (orderId) {
    const rawOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            inventoryItem: true
          }
        }
      }
    });

    // Convert Decimal fields to numbers for client component
    if (rawOrder) {
      order = {
        ...rawOrder,
        totalAmount: rawOrder.totalAmount?.toNumber() || 0,
        items: rawOrder.items.map(item => ({
          ...item,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          vatRatePercent: item.vatRatePercent?.toNumber() || 25.5,
          discountAmount: item.discountAmount?.toNumber() || null,
          discountPercentage: item.discountPercentage?.toNumber() || null,
          inventoryItem: {
            ...item.inventoryItem,
            costPrice: item.inventoryItem.costPrice.toNumber(),
            salesPrice: item.inventoryItem.salesPrice.toNumber(),
            minimumStockLevel: item.inventoryItem.minimumStockLevel?.toNumber() || 0,
            reorderLevel: item.inventoryItem.reorderLevel?.toNumber() || 0,
            quantityOnHand: item.inventoryItem.quantityOnHand?.toNumber() || 0,
            defaultVatRatePercent: item.inventoryItem.defaultVatRatePercent?.toNumber() || null,
          }
        }))
      };
    }
  }

  return { customers, inventoryItems: processedInventoryItems, order }; // Adjust as needed
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
export default async function AddInvoicePage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) {
    redirect('/auth/signin');
  }

  const resolvedSearchParams = await searchParams;
  const orderId = typeof resolvedSearchParams.orderId === 'string' ? resolvedSearchParams.orderId : undefined;
  const { customers, inventoryItems, order } = await getFormData(orderId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-bold">Create Invoice</h1>
      <Suspense fallback={<Skeleton className="h-[400px]" />}>
        <InvoiceForm 
          customers={customers} 
          inventoryItems={inventoryItems}
          order={order} // Pass the order for prefilling
        />
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