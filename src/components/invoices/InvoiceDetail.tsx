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
import { MoreHorizontal, FileText, CreditCard, Send, Download } from 'lucide-react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { SendConfirmationModal, type SendMethod } from "@/components/common/SendConfirmationModal";

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
  const [showSendModal, setShowSendModal] = useState(false);

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

  const handleSendInvoice = async (method: SendMethod) => {
    try {
      if (method === "email-pdf") {
        // Check if customer has email
        if (!invoice.customer.email) {
          toast.error("Customer email is required to send invoice");
          return;
        }
        // Use the existing send service
        const { sendInvoiceEmail } = await import("@/lib/services/send.service");
        await sendInvoiceEmail({
          invoiceId: invoice.id,
          method: "email-pdf",
        });
        toast.success("Invoice sent successfully!");
      } else if (method === "download-pdf") {
        // Placeholder for PDF download
        toast.info("PDF download functionality will be implemented soon");
      } else if (method === "download-xml") {
        // Use existing Finvoice export
        await handleFinvoiceExport();
      }
    } catch (error) {
      console.error("Send invoice error:", error);
      toast.error("Failed to send invoice. Please try again.");
    }
  };

  const canSendInvoice = () => {
    // Allow sending for draft and sent invoices if customer has email
    return (invoice.status === PrismaInvoiceStatus.draft || 
            invoice.status === PrismaInvoiceStatus.sent) &&
           invoice.customer.email &&
           invoice.status !== PrismaInvoiceStatus.cancelled;
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
      {/* Header with Invoice Number and Actions */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate" title={`Invoice ${invoice.invoiceNumber}`}>
              Invoice {invoice.invoiceNumber}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(invoice.status)}`}>
                {invoice.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-sm text-muted-foreground">
                Created {new Date(invoice.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Send Button */}
            {(invoice.status === 'DRAFT' || invoice.status === 'SENT' || invoice.status === 'OVERDUE') && 
             invoice.customer.email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendModal(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/invoices/${invoice.id}/edit`} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Edit Invoice
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleFinvoiceExport()} 
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Finvoice XML
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleCreateCreditNote()} 
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Create Credit Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Finnish Bill Layout - Addresses and Invoice Info */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Billing Address (Prominent like Finnish bills) */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Billing Address */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Laskutusosoite / Billing Address
                </h3>
                <div className="text-sm space-y-1">
                  <div className="font-semibold">{invoice.customer.name}</div>
                  {invoice.customer.contactPerson && (
                    <div className="text-muted-foreground">{invoice.customer.contactPerson}</div>
                  )}
                  <div>{invoice.customer.address}</div>
                  <div>{invoice.customer.postalCode} {invoice.customer.city}</div>
                  {invoice.customer.country && invoice.customer.country !== 'Finland' && (
                    <div>{invoice.customer.country}</div>
                  )}
                  {invoice.customer.vatNumber && (
                    <div className="text-muted-foreground">VAT: {invoice.customer.vatNumber}</div>
                  )}
                </div>
              </div>

              {/* Shipping Address (if different) */}
              {(invoice.customer.shippingAddress || 
                invoice.customer.shippingCity || 
                invoice.customer.shippingPostalCode) && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Toimitusosoite / Shipping Address
                  </h3>
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">{invoice.customer.name}</div>
                    <div>{invoice.customer.shippingAddress || invoice.customer.address}</div>
                    <div>
                      {invoice.customer.shippingPostalCode || invoice.customer.postalCode}{' '}
                      {invoice.customer.shippingCity || invoice.customer.city}
                    </div>
                    {invoice.customer.shippingCountry && (
                      <div>{invoice.customer.shippingCountry}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Columns - Invoice Details */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Information */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Laskun tiedot / Invoice Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Number:</span>
                    <span className="font-mono">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Date:</span>
                    <span>{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                  </div>
                  {invoice.referenceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reference:</span>
                      <span className="font-mono">{invoice.referenceNumber}</span>
                    </div>
                  )}
                  {invoice.orderNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order Number:</span>
                      <span>{invoice.orderNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Maksutiedot / Payment Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <span>{invoice.paymentTerms || 'Net 14'}</span>
                  </div>
                  {invoice.customer.language && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Language:</span>
                      <span>{invoice.customer.language}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Total Amount:</span>
                    <span>€{Number(invoice.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Items - Enhanced with all data */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-semibold mb-4">Laskurivit / Invoice Items</h3>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-sm font-medium">Description</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">Qty</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">Unit Price</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">Discount</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">VAT %</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">Net Amount</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">VAT Amount</th>
                  <th className="px-4 py-3 text-sm font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item: any, index: number) => {
                  const unitPrice = Number(item.unitPrice);
                  const quantity = Number(item.quantity);
                  const discountAmount = Number(item.discountAmount || 0);
                  const discountPercentage = Number(item.discountPercentage || 0);
                  const vatRate = Number(item.vatRatePercent || 0);
                  
                  // Calculate net amount after discount
                  const grossAmount = unitPrice * quantity;
                  const totalDiscount = discountAmount + (grossAmount * discountPercentage / 100);
                  const netAmount = grossAmount - totalDiscount;
                  const vatAmount = netAmount * (vatRate / 100);
                  const totalAmount = netAmount + vatAmount;

                  return (
                    <tr key={index} className="hover:bg-muted/25">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{item.description}</div>
                          {item.rowFreeText && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {item.rowFreeText}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        €{unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {totalDiscount > 0 ? (
                          <div className="text-red-600">
                            {discountAmount > 0 && `-€${discountAmount.toFixed(2)}`}
                            {discountAmount > 0 && discountPercentage > 0 && <br />}
                            {discountPercentage > 0 && `-${discountPercentage.toFixed(1)}%`}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {vatRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        €{netAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        €{vatAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        €{totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-md space-y-2">
            {/* VAT Summary by Rate */}
            {(() => {
              const vatSummary = invoice.items.reduce((acc: Record<number, { netAmount: number; vatAmount: number }>, item: any) => {
                const vatRate = Number(item.vatRatePercent || 0);
                const quantity = Number(item.quantity);
                const unitPrice = Number(item.unitPrice);
                const discountAmount = Number(item.discountAmount || 0);
                const discountPercentage = Number(item.discountPercentage || 0);
                
                const grossAmount = unitPrice * quantity;
                const totalDiscount = discountAmount + (grossAmount * discountPercentage / 100);
                const netAmount = grossAmount - totalDiscount;
                const vatAmount = netAmount * (vatRate / 100);
                
                if (!acc[vatRate]) {
                  acc[vatRate] = { netAmount: 0, vatAmount: 0 };
                }
                acc[vatRate].netAmount += netAmount;
                acc[vatRate].vatAmount += vatAmount;
                
                return acc;
              }, {} as Record<number, { netAmount: number; vatAmount: number }>);

              return Object.entries(vatSummary).map(([rate, amounts]) => {
                const amountsTyped = amounts as { netAmount: number; vatAmount: number };
                return (
                  <div key={rate} className="flex justify-between text-sm">
                    <span>VAT {Number(rate).toFixed(1)}% on €{amountsTyped.netAmount.toFixed(2)}:</span>
                    <span className="font-mono">€{amountsTyped.vatAmount.toFixed(2)}</span>
                  </div>
                );
              });
            })()}
            
            <div className="border-t pt-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span className="font-mono">€{Number(invoice.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Huomautukset / Notes</h4>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Send Modal */}
      <SendConfirmationModal
        target="invoice"
        open={showSendModal}
        onOpenChange={setShowSendModal}
        onConfirm={handleSendInvoice}
      />
    </div>
  );
} 