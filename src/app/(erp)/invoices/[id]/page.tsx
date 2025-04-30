import { Suspense } from 'react';
import { notFound } from 'next/navigation';
// import { Prisma } from '@prisma/client'; // Ensure this is removed
import { getInvoiceById } from '@/lib/actions/invoice.actions';
import InvoiceDetail from '@/components/invoices/InvoiceDetail';
// --- Add necessary imports for mapping ---
import { Invoice as LocalInvoice, InvoiceItem as LocalInvoiceItem, InvoiceStatus } from '@/lib/types/invoice.types'; 
import { Customer as LocalCustomer, Address as LocalAddress, AddressType } from '@/lib/types/customer.types';
import { Order as LocalOrder } from '@/lib/types/order.types'; // Assuming basic Order type is needed if mapping order link
import { UUID, Decimal as LocalDecimal, createUUID } from '@/lib/types/branded'; 

// Define standard Props type for App Router pages
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// --- Top-level Mapping Function ---
// Use 'any' for input type due to persistent inference issues
const mapPrismaInvoiceToLocal = (prismaInvoice: any): LocalInvoice => {
  // Assume structure based on Prisma schema and includes
  
  const mapPrismaAddressToLocal = (addr: any): LocalAddress => ({ 
    ...addr,
    id: addr.id, 
    type: addr.type as AddressType,
  });

  const mapPrismaCustomerToLocal = (cust: any): LocalCustomer => ({
    ...cust,
    id: createUUID(cust.id ?? ''), 
    addresses: cust.addresses ? cust.addresses.map(mapPrismaAddressToLocal) : [], 
  });

  const mapPrismaInvoiceItemToLocal = (item: any): LocalInvoiceItem => ({
    ...item,
    id: createUUID(item.id),
    invoiceId: createUUID(item.invoiceId),
    // Assume item.quantity etc. are Prisma Decimal objects
    quantity: item.quantity.toNumber() as LocalDecimal, 
    unitPrice: item.unitPrice.toNumber() as LocalDecimal,
    vatRatePercent: item.vatRatePercent.toNumber() as LocalDecimal,
    description: item.description ?? '', 
  });

  return {
      // Cast prismaInvoice to any to allow spreading unknown structure
      ...(prismaInvoice as any),
      // Explicitly map/override fields
      id: createUUID(prismaInvoice.id),
      customerId: createUUID(prismaInvoice.customerId ?? ''),
      orderId: prismaInvoice.orderId ? createUUID(prismaInvoice.orderId) : undefined,
      status: prismaInvoice.status as InvoiceStatus, 
      notes: prismaInvoice.notes ?? undefined, 
      totalAmount: prismaInvoice.totalAmount.toNumber() as LocalDecimal,
      totalVatAmount: prismaInvoice.totalVatAmount.toNumber() as LocalDecimal,
      customer: mapPrismaCustomerToLocal(prismaInvoice.customer),
      items: prismaInvoice.items.map(mapPrismaInvoiceItemToLocal),
      originalInvoiceId: prismaInvoice.originalInvoiceId ? createUUID(prismaInvoice.originalInvoiceId) : undefined,
      creditNoteId: prismaInvoice.creditNoteId ? createUUID(prismaInvoice.creditNoteId) : undefined,
      order: undefined, 
  };
};
// --- End Mapping Function ---

// Use the correct Props type
export default async function InvoicePage({ params }: Props) { 
  // Await params before accessing id
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const result = await getInvoiceById(id);

  if (!result.success) {
    console.error("Error fetching invoice:", result.error);
    notFound(); 
  }
  
  const fetchedInvoice = result.data;

  if (!fetchedInvoice) {
    notFound(); 
  }

  // Call the top-level mapping function
  const invoice = mapPrismaInvoiceToLocal(fetchedInvoice);

  return (
    <div className="p-6">
      <Suspense fallback={<div>Loading invoice details...</div>}>
        <InvoiceDetail invoice={invoice} />
      </Suspense>
    </div>
  );
} 