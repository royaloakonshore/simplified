"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  generateAndDownloadFinvoice, 
  updateInvoiceStatus,
  recordPayment,
  createCreditNote
} from '@/lib/actions/invoice.actions';
import { toast } from 'react-toastify';
import { 
  type Invoice as PrismaInvoiceOriginal,
  type Customer as PrismaCustomer, 
  type InvoiceItem as PrismaInvoiceItemOriginal,
  type InventoryItem as PrismaInventoryItem,
  type Address as PrismaAddress,
  type Order as PrismaOrderOriginal,
  type Payment as PrismaPaymentOriginal,
  type OrderItem as PrismaOrderItemOriginal,
  InvoiceStatus as PrismaInvoiceStatus
} from '@prisma/client';
import { 
  Button
} from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, FileText, CreditCard, Copy, Trash2, Send, XCircle } from 'lucide-react';

// --- Type overrides for stringified Decimals ---
type InvoiceWithStringDecimals = Omit<PrismaInvoiceOriginal, 'totalAmount' | 'totalVatAmount' | 'paidAmount' | 'creditedAmount'> & {
  totalAmount: string;
  totalVatAmount: string;
  paidAmount: string | null;
  creditedAmount: string | null;
};

type InvoiceItemWithStringDecimals = Omit<PrismaInvoiceItemOriginal, 'quantity' | 'unitPrice' | 'vatRatePercent' | 'discountAmount' | 'discountPercentage' | 'calculatedUnitCost' | 'calculatedUnitProfit' | 'calculatedLineProfit'> & {
  quantity: string;
  unitPrice: string;
  vatRatePercent: string;
  discountAmount: string | null;
  discountPercentage: string | null;
  calculatedUnitCost: string | null;
  calculatedUnitProfit: string | null;
  calculatedLineProfit: string | null;
  inventoryItem: PrismaInventoryItem | null;
};

type OrderItemWithStringDecimals = Omit<PrismaOrderItemOriginal, 'quantity' | 'unitPrice' | 'discountAmount' | 'discountPercentage'> & {
    quantity: string;
    unitPrice: string;
    discountAmount: string | null;
    discountPercentage: string | null;
    inventoryItem?: PrismaInventoryItem;
};

type OrderWithStringDecimals = Omit<PrismaOrderOriginal, 'totalAmount' | 'items'> & {
  totalAmount: string | null; 
  items?: OrderItemWithStringDecimals[];
  customer?: PrismaCustomer; 
};

type PaymentWithStringDecimals = Omit<PrismaPaymentOriginal, 'amount'> & {
  amount: string;
};
// --- End Type overrides ---

type FullInvoiceFromApi = InvoiceWithStringDecimals & {
  customer: PrismaCustomer & {
    addresses?: PrismaAddress[] | null;
  };
  items: InvoiceItemWithStringDecimals[];
  order: OrderWithStringDecimals | null;
  payments: PaymentWithStringDecimals[];
};

// Import the local, branded Invoice type for the mapping function
import { type Invoice as BrandedInvoice, type InvoiceItem as BrandedInvoiceItem, InvoiceStatus as BrandedInvoiceStatus } from '@/lib/types/invoice.types';
import { type Customer as BrandedCustomer, type Address as BrandedAddress } from '@/lib/types/customer.types';
import { type Order as BrandedOrder, type OrderItem as BrandedOrderItem } from '@/lib/types/order.types';
import { type UUID as BrandedUUID, type Decimal as BrandedDecimal } from '@/lib/types/branded';

// Helper to map a BrandedInvoice (from createCreditNote action) to FullInvoiceFromApi
const mapBrandedInvoiceToFullInvoiceApi = (brandedInvoice: BrandedInvoice): FullInvoiceFromApi => {
  // Drastically simplified mapping to avoid persistent linter issues with deep optional chaining and type mismatches.
  // Focus on top-level fields and Decimal to string conversion.
  // Nested objects are cast to any; this sacrifices some type safety for build stability.
  return {
    // Top-level Invoice fields from BrandedInvoice
    id: brandedInvoice.id.toString(),
    invoiceNumber: brandedInvoice.invoiceNumber,
    invoiceDate: new Date(brandedInvoice.invoiceDate), // Ensure Date type
    dueDate: new Date(brandedInvoice.dueDate), // Ensure Date type
    status: brandedInvoice.status as unknown as PrismaInvoiceStatus, // Cast status
    totalAmount: brandedInvoice.totalAmount.toString(),
    totalVatAmount: brandedInvoice.totalVatAmount.toString(),
    vatReverseCharge: brandedInvoice.vatReverseCharge,
    notes: brandedInvoice.notes ?? null,
    paymentDate: brandedInvoice.paymentDate ? new Date(brandedInvoice.paymentDate) : null,
    createdAt: new Date(brandedInvoice.createdAt),
    updatedAt: new Date(brandedInvoice.updatedAt),
    customerId: brandedInvoice.customerId.toString(),
    orderId: brandedInvoice.orderId ? brandedInvoice.orderId.toString() : null,
    originalInvoiceId: brandedInvoice.originalInvoiceId ? brandedInvoice.originalInvoiceId.toString() : null,
    creditNoteId: brandedInvoice.creditNoteId ? brandedInvoice.creditNoteId.toString() : null,

    // Related objects - simplified with `as any` for nested parts
    customer: {
      ...(brandedInvoice.customer as any), 
      id: brandedInvoice.customer.id?.toString() ?? 'placeholder-customer-id',
      addresses: brandedInvoice.customer.addresses?.map(addr => ({ 
          ...(addr as any),
          id: addr.id?.toString() ?? 'placeholder-address-id'
        })) ?? [],
    } as PrismaCustomer & { addresses?: PrismaAddress[] | null }, 

    items: brandedInvoice.items.map((item: BrandedInvoiceItem) => ({
      ...(item as any), 
      id: item.id.toString(),
      invoiceId: item.invoiceId.toString(),
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      vatRatePercent: item.vatRatePercent.toString(),
      discountAmount: item.discountAmount ? item.discountAmount.toString() : null,
      discountPercent: item.discountPercent ? item.discountPercent.toString() : null,
      calculatedUnitCost: null, 
      calculatedUnitProfit: null,
      calculatedLineProfit: null,
      inventoryItem: null, 
    })) as InvoiceItemWithStringDecimals[], 

    order: brandedInvoice.order ? {
      ...(brandedInvoice.order as any), 
      id: brandedInvoice.order.id.toString(),
      customerId: brandedInvoice.order.customerId.toString(),
      totalAmount: brandedInvoice.order.totalAmount.toString(),
      items: brandedInvoice.order.items?.map(oi => ({
          ...(oi as any),
          id: oi.id.toString(),
          orderId: oi.orderId.toString(),
          inventoryItemId: oi.itemId.toString(), 
          quantity: oi.quantity.toString(),
          unitPrice: oi.unitPrice.toString(),
          discountAmount: oi.discountAmount ? oi.discountAmount.toString() : null,
          discountPercent: oi.discountPercent ? oi.discountPercent.toString() : null,
          inventoryItem: (oi.item as any) as PrismaInventoryItem | undefined,
      })) ?? [],
      customer: brandedInvoice.order.customer ? {
          ...(brandedInvoice.order.customer as any),
          id: brandedInvoice.order.customer.id?.toString() ?? 'placeholder-customer-id-in-order',
          addresses: brandedInvoice.order.customer.addresses?.map(addr => ({ 
              ...(addr as any),
              id: addr.id?.toString() ?? 'placeholder-address-id-in-order'
            })) ?? [],
      } : undefined,
    } as OrderWithStringDecimals : null, 

    payments: (brandedInvoice as any).payments?.map((p: any) => ({ 
        ...p,
        id: p.id.toString(),
        invoiceId: p.invoiceId.toString(),
        amount: p.amount.toString(),
        paymentDate: new Date(p.paymentDate)
    })) ?? [],

    companyId: (brandedInvoice as any).companyId ?? null,
    userId: (brandedInvoice as any).userId ?? null,
    isCreditNote: (brandedInvoice as any).isCreditNote ?? false,
    pdfUrl: (brandedInvoice as any).pdfUrl ?? null,
    sentAt: (brandedInvoice as any).sentAt ? new Date((brandedInvoice as any).sentAt) : null,
    paidAmount: (brandedInvoice as any).paidAmount ? (brandedInvoice as any).paidAmount.toString() : ((brandedInvoice.status === BrandedInvoiceStatus.PAID) ? brandedInvoice.totalAmount.toString() : '0'),
    creditedAmount: (brandedInvoice as any).creditedAmount ? (brandedInvoice as any).creditedAmount.toString() : ((brandedInvoice.status === BrandedInvoiceStatus.CREDITED) ? brandedInvoice.totalAmount.toString() : '0'),
  } as FullInvoiceFromApi;
};

interface InvoiceDetailProps {
  invoice: FullInvoiceFromApi;
}

export default function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PrismaInvoiceStatus | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCrediting, setIsCrediting] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount: string | number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    const num = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(num);
  };

  const getStatusBadgeClass = (status: PrismaInvoiceStatus): string => {
    const statusColors: Record<string, string> = {
      [PrismaInvoiceStatus.draft]: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200',
      [PrismaInvoiceStatus.sent]: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-200',
      [PrismaInvoiceStatus.paid]: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200',
      [PrismaInvoiceStatus.overdue]: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-200',
      [PrismaInvoiceStatus.cancelled]: 'bg-neutral-400 text-neutral-800 dark:bg-neutral-600 dark:text-neutral-100',
      [PrismaInvoiceStatus.credited]: 'bg-gray-400 text-gray-800 dark:bg-gray-600 dark:text-gray-100',
    };
    return statusColors[status] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-500 dark:text-neutral-50';
  };

  const getAvailableStatusTransitions = (): PrismaInvoiceStatus[] => {
    if (invoice.status === PrismaInvoiceStatus.draft) return [PrismaInvoiceStatus.sent, PrismaInvoiceStatus.cancelled];
    if (invoice.status === PrismaInvoiceStatus.sent) return [PrismaInvoiceStatus.paid, PrismaInvoiceStatus.cancelled];
    if (invoice.status === PrismaInvoiceStatus.overdue) return [PrismaInvoiceStatus.paid, PrismaInvoiceStatus.cancelled];
    return [];
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await updateInvoiceStatus(invoice.id, selectedStatus);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update status');
      }
      toast.success(`Invoice status updated to ${selectedStatus}`);
      setShowStatusModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
      toast.error(err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRecordPayment = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await recordPayment(invoice.id, paymentDate);
      if (!result.success) {
        throw new Error(result.error || 'Failed to record payment');
      }
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
      toast.error(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinvoiceExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = await generateAndDownloadFinvoice(invoice.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate Finvoice XML');
      }
      const blob = new Blob([result.data.xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export Finvoice');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateCreditNote = async () => {
    setIsCrediting(true);
    setCreditError(null);

    try {
      const result = await createCreditNote(invoice.id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create credit note');
      }
      if (!result.data) {
        throw new Error('Credit note creation succeeded but no data was returned.');
      }

      const newCreditNoteForDisplay = mapBrandedInvoiceToFullInvoiceApi(result.data as BrandedInvoice); 
      toast.success(`Credit note ${newCreditNoteForDisplay.invoiceNumber} created successfully!`);
      router.push(`/invoices/${newCreditNoteForDisplay.id}`); 
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : 'Could not create credit note');
      toast.error(err instanceof Error ? err.message : 'Could not create credit note');
    } finally {
      setIsCrediting(false);
    }
  };

  const availableStatusTransitions = getAvailableStatusTransitions();
  const canExportFinvoice = invoice.status === PrismaInvoiceStatus.sent || invoice.status === PrismaInvoiceStatus.paid || invoice.status === PrismaInvoiceStatus.overdue;
  const canRecordPayment = invoice.status === PrismaInvoiceStatus.sent || invoice.status === PrismaInvoiceStatus.overdue;
  const canBeCredited = [PrismaInvoiceStatus.sent, PrismaInvoiceStatus.paid, PrismaInvoiceStatus.overdue].includes(invoice.status as any);

  // Helper to render an address block
  const AddressBlock = ({ address, title }: { address?: PrismaAddress | null, title: string }) => {
    if (!address) return null;
    return (
      <div>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <div className="text-sm space-y-1 text-muted-foreground">
          <p>{address.streetAddress}</p>
          <p>{address.postalCode} {address.city}</p>
          <p>{address.countryCode}</p>
        </div>
      </div>
    );
  };

  const billingAddress = invoice.customer.addresses?.find(addr => addr.type === 'billing');
  const shippingAddress = invoice.customer.addresses?.find(addr => addr.type === 'shipping');

  return (
    <div className="bg-card text-card-foreground rounded-md shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
           <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate" title={`Invoice ${invoice.invoiceNumber}`}>Invoice {invoice.invoiceNumber}</h2>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(invoice.status)}`}>
              {invoice.status.replace('_', ' ').toUpperCase()}
            </span>
            <div className="mt-2 text-sm text-muted-foreground">
                <p>Invoice Date: {formatDate(invoice.invoiceDate)}</p>
                <p>Due Date: {formatDate(invoice.dueDate)}</p>
            </div>
           </div>
           <div className="flex items-center space-x-2">
             {availableStatusTransitions.length > 0 && (
               <Button variant="outline" onClick={() => setShowStatusModal(true)}>Update Status</Button>
             )}
             {canRecordPayment && (
                <Button variant="outline" onClick={() => setShowPaymentModal(true)}>Record Payment</Button>
             )}
             {(canExportFinvoice || canBeCredited) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canExportFinvoice && (
                      <DropdownMenuItem onClick={handleFinvoiceExport} disabled={isExporting}>
                        <FileText className="mr-2 h-4 w-4" />
                        {isExporting ? 'Exporting Finvoice...' : 'Export Finvoice'}
                      </DropdownMenuItem>
                    )}
                    {canBeCredited && (
                      <DropdownMenuItem onClick={handleCreateCreditNote} disabled={isCrediting}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isCrediting ? 'Crediting...' : 'Create Credit Note'}
                      </DropdownMenuItem>
                    )}
                    {/* Placeholder for future actions */}
                    {/* <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <FileText className="mr-2 h-4 w-4" /> Export PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" /> Copy Invoice
                    </DropdownMenuItem> */}
                  </DropdownMenuContent>
                </DropdownMenu>
             )}
           </div>
        </div>
        {invoice.originalInvoiceId && (
          <p className="text-sm mt-2">Credits Invoice ID: <Link href={`/invoices/${invoice.originalInvoiceId}`} className="text-blue-600 hover:underline">{invoice.originalInvoiceId}</Link></p>
        )}
        {invoice.creditNoteId && (
          <p className="text-sm mt-2">Credited by Invoice ID: <Link href={`/invoices/${invoice.creditNoteId}`} className="text-blue-600 hover:underline">{invoice.creditNoteId}</Link></p>
        )}
      </div>

      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Customer</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-primary">
              <Link href={`/customers/${invoice.customer.id}`} className="hover:underline">
                {invoice.customer.name}
              </Link>
            </p>
            {/* Display primary contact info if no separate addresses or only one type */}
            {(!billingAddress && !shippingAddress && invoice.customer.addresses && invoice.customer.addresses.length > 0) && (
                 <>
                    <p>{invoice.customer.addresses[0].streetAddress}</p>
                    <p>{invoice.customer.addresses[0].postalCode} {invoice.customer.addresses[0].city}</p>
                    <p>{invoice.customer.addresses[0].countryCode}</p>
                 </>
            )}
            <p>{invoice.customer.email}</p>
            <p>{invoice.customer.phone}</p>
          </div>
        </div>
        
        <AddressBlock address={billingAddress} title="Billing Address" />
        {/* Spacer div or conditional rendering for layout if only one of billing/shipping exists could be added here */}
        <AddressBlock address={shippingAddress} title="Shipping Address" />
        
        <div>
          <h3 className="text-lg font-medium mb-2">Invoice Summary</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p>Subtotal: {formatCurrency(invoice.totalAmount)}</p>
            <p>VAT Amount: {formatCurrency(invoice.totalVatAmount)}</p>
            <p>Total: {formatCurrency(Number(invoice.totalAmount) + Number(invoice.totalVatAmount))}</p>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="px-6 py-4 border-t border-border">
          <h3 className="text-lg font-medium mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      <div className="px-6 py-4 border-t border-border">
        <h3 className="text-lg font-medium mb-4">Invoice Items</h3>
        <div className="overflow-x-auto">
          <div className="border border-border rounded-md">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Quantity</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Unit Price</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">VAT Rate</th>
                  <th className="px-6 py-4 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 align-top">{item.description || item.inventoryItem?.name}</td>
                    <td className="px-6 py-4 align-top">{item.quantity}</td>
                    <td className="px-6 py-4 align-top">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-4 align-top">{item.vatRatePercent}%</td>
                    <td className="px-6 py-4 align-top text-right">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-medium text-muted-foreground">Subtotal</td>
                  <td className="px-6 py-4 text-right font-medium text-muted-foreground">{formatCurrency(invoice.totalAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-medium text-muted-foreground">VAT</td>
                  <td className="px-6 py-4 text-right font-medium text-muted-foreground">{formatCurrency(invoice.totalVatAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-muted-foreground">TOTAL</td>
                  <td className="px-6 py-4 text-right font-bold text-muted-foreground">{formatCurrency(Number(invoice.totalAmount) + Number(invoice.totalVatAmount))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {error && <div className="p-4 text-red-500">Error: {error}</div>}
      {creditError && <div className="p-4 text-red-500">Error: {creditError}</div>}
    </div>
  );
} 