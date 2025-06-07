"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  generateAndDownloadFinvoice, 
  createCreditNote
} from '@/lib/actions/invoice.actions';
import { toast } from "sonner";
import { type inferRouterOutputs } from '@trpc/server';
import { type AppRouter } from "@/lib/api/root";
import { 
  InvoiceStatus as PrismaInvoiceStatus
} from '@prisma/client';
import { 
  Button
} from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileText, CreditCard } from 'lucide-react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow,
  TableFooter
} from "@/components/ui/table";

// --- Start: New types inferred from tRPC router ---
type RouterOutput = inferRouterOutputs<AppRouter>;
type InvoiceDetailData = RouterOutput['invoice']['get'];
// --- End: New types inferred from tRPC router ---

interface InvoiceDetailProps {
  invoice: InvoiceDetailData;
}

export default function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleFinvoiceExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = await generateAndDownloadFinvoice(invoice.id);
      if (result.success) {
        // Explicitly check properties of result.data
        if (result.data && typeof result.data.xml === 'string' && typeof result.data.filename === 'string') {
          const { xml, filename } = result.data; // Now this should be safe
          const blob = new Blob([xml], { type: 'application/xml' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success("Finvoice XML downloaded.");
        } else {
          toast.error("Finvoice data is incomplete or missing after successful generation.");
          setError("Finvoice data is incomplete or missing.");
        }
      } else {
        if (typeof result.error === 'string') {
            toast.error(`Failed to generate Finvoice XML: ${result.error}`);
        } else {
            toast.error("Failed to generate Finvoice XML. An unknown error occurred.");
        }
        setError(result.error || "Failed to generate Finvoice XML.");
      }
    } catch (e: unknown) {
      toast.error("An unexpected error occurred during export.");
      if (e instanceof Error) {
        setError(e.message || 'Failed to export Finvoice XML.');
      } else {
        setError('Failed to export Finvoice XML.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateCreditNote = async () => {
    setCreditError(null);
    setIsCrediting(true);
    try {
      if (!invoice.id) {
          throw new Error("Invoice ID is missing.");
      }
      const result = await createCreditNote(invoice.id);
      if (result.success && result.data) {
        toast.success(`Credit note created successfully: ${result.data.invoiceNumber}`);
        router.push(`/invoices/${result.data.id}`);
        router.refresh(); 
      } else {
        const errorMessage = !result.success ? result.error : "An unknown error occurred.";
        setCreditError(errorMessage);
        toast.error(`Failed to create credit note: ${errorMessage}`);
      }
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        setCreditError(errorMessage);
        toast.error(`An exception occurred: ${errorMessage}`);
    } finally {
      setIsCrediting(false);
    }
  };

  const canExportFinvoice = invoice.status === PrismaInvoiceStatus.sent || invoice.status === PrismaInvoiceStatus.paid || invoice.status === PrismaInvoiceStatus.overdue;
  const canBeCredited = ([PrismaInvoiceStatus.sent, PrismaInvoiceStatus.paid, PrismaInvoiceStatus.overdue] as PrismaInvoiceStatus[]).includes(invoice.status);

  // Helper to render an address block
  const AddressBlock = ({ address, title }: { address?: InvoiceDetailData['customer']['addresses'][number] | null, title: string }) => {
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

  const billingAddress = invoice.customer.addresses?.find((addr: InvoiceDetailData['customer']['addresses'][number]) => addr.type === 'billing');
  const shippingAddress = invoice.customer.addresses?.find((addr: InvoiceDetailData['customer']['addresses'][number]) => addr.type === 'shipping');

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
             {/* The following block related to availableStatusTransitions and the Update Status button is removed
             {availableStatusTransitions.length > 0 && (
               <Button variant="outline" onClick={() => setShowStatusModal(true)}>Update Status</Button>
             )}
             */}
             {canExportFinvoice && (
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
          <div className="bg-background p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Invoice Items</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item: InvoiceDetailData['items'][number]) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.inventoryItem?.name ?? 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Subtotal</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(invoice.totalAmount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">VAT</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(invoice.totalVatAmount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(Number(invoice.totalAmount) + Number(invoice.totalVatAmount))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      </div>

      {error && <div className="p-4 text-red-500">Error: {error}</div>}
      {creditError && <div className="p-4 text-red-500">Error: {creditError}</div>}
    </div>
  );
} 