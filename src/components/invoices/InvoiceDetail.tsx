"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InvoiceStatus } from '@/lib/types/invoice.types'; // Local enum
import { generateAndDownloadFinvoice, updateInvoiceStatus, recordPayment, createCreditNote } from '@/lib/actions/invoice.actions';
import { Invoice } from '@/lib/types/invoice.types'; // Use local Invoice type
import { Customer } from '@/lib/types/customer.types';
import { toast } from 'react-toastify'; // Import from react-toastify

// Use the imported Invoice type for the prop
interface InvoiceDetailProps {
  invoice: Invoice;
}

export default function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCrediting, setIsCrediting] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    const num = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(num);
  };

  const getStatusBadgeClass = (status: string): string => {
    const statusColors: Record<string, string> = {
      [InvoiceStatus.DRAFT]: 'bg-neutral-200 text-neutral-800',
      [InvoiceStatus.SENT]: 'bg-blue-100 text-blue-800',
      [InvoiceStatus.PAID]: 'bg-green-100 text-green-800',
      [InvoiceStatus.OVERDUE]: 'bg-red-100 text-red-800',
      [InvoiceStatus.CANCELLED]: 'bg-neutral-400 text-neutral-800',
      [InvoiceStatus.CREDITED]: 'bg-gray-400 text-gray-800',
    };
    return statusColors[status] || 'bg-neutral-100 text-neutral-800';
  };

  // Simplified available status transitions (add more logic later)
  const getAvailableStatusTransitions = (): InvoiceStatus[] => {
    if (invoice.status === InvoiceStatus.DRAFT) return [InvoiceStatus.SENT, InvoiceStatus.CANCELLED];
    if (invoice.status === InvoiceStatus.SENT) return [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]; // Or RECORD_PAYMENT action
    if (invoice.status === InvoiceStatus.OVERDUE) return [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]; // Or RECORD_PAYMENT action
    return [];
  };

  const handleStatusUpdate = async () => { /* ... calls updateInvoiceStatus ... */ };
  const handleRecordPayment = async () => { /* ... calls recordPayment ... */ };

  const handleFinvoiceExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const result = await generateAndDownloadFinvoice(invoice.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate Finvoice XML');
      }
      // Trigger download
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

  // Function to handle credit note creation
  const handleCreateCreditNote = async () => {
    setIsCrediting(true);
    setCreditError(null);

    type CreditNoteResult = { 
        success: boolean; 
        data?: Invoice; 
        error?: string; 
    };

    try {
      // Use invoice.id which should be UUID now thanks to mapping or direct type
      const result: CreditNoteResult = await createCreditNote(invoice.id.toString()); // Ensure ID is string for action
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create credit note');
      }
      toast.success(`Credit note ${result.data.invoiceNumber} created successfully!`); // Use react-toastify
      router.push(`/invoices/${result.data.id.toString()}`); // Ensure ID is string for route
      // router.refresh(); // Refresh might not be needed after push
    } catch (err) {
      setCreditError(err instanceof Error ? err.message : 'Could not create credit note');
      toast.error(err instanceof Error ? err.message : 'Could not create credit note'); // Add toast error
    } finally {
      setIsCrediting(false);
    }
  };

  const availableStatusTransitions = getAvailableStatusTransitions();
  const canExportFinvoice = invoice.status === InvoiceStatus.SENT || invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.OVERDUE;
  const canRecordPayment = invoice.status === InvoiceStatus.SENT || invoice.status === InvoiceStatus.OVERDUE;
  const canBeCredited = [InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE].includes(invoice.status);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md shadow overflow-hidden">
      {/* Header with Status Badge, Actions (Update Status, Record Payment, Export Finvoice) */}
      <div className="px-6 py-4 border-b ...">
        {/* ... Invoice Number, Status ... */} 
        <div className="flex items-center space-x-2">
          {/* ... Status Badge ... */} 
          {availableStatusTransitions.length > 0 && (
            <button onClick={() => setShowStatusModal(true)} className="...">Update Status</button>
          )}
          {canRecordPayment && (
             <button onClick={() => setShowPaymentModal(true)} className="...">Record Payment</button>
          )}
          {canExportFinvoice && (
            <button onClick={handleFinvoiceExport} disabled={isExporting} className="...">
              {isExporting ? 'Exporting...' : 'Export Finvoice'}
            </button>
          )}
          {canBeCredited && (
            <button onClick={handleCreateCreditNote} disabled={isCrediting} className="...">
              {isCrediting ? 'Crediting...' : 'Create Credit Note'}
            </button>
          )}
        </div>
        {/* ... Dates ... */} 
        {/* Display links if they exist */}
        {invoice.originalInvoiceId && (
          <p className="text-sm mt-2">Credits Invoice: <Link href={`/invoices/${invoice.originalInvoiceId}`} className="text-blue-600 hover:underline">{invoice.originalInvoice?.invoiceNumber || invoice.originalInvoiceId}</Link></p>
        )}
        {invoice.creditNoteId && (
          <p className="text-sm mt-2">Credited by: <Link href={`/invoices/${invoice.creditNoteId}`} className="text-blue-600 hover:underline">{invoice.creditNote?.invoiceNumber || invoice.creditNoteId}</Link></p>
        )}
      </div>

      {/* Invoice Details (Customer, Summary) */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ... Customer Info ... */} 
        {/* ... Invoice Summary (Totals, VAT) ... */}
      </div>

      {/* Invoice Items Table */}
      <div className="px-6 py-4 border-t ...">
        <h3>Invoice Items</h3>
        <table>
           {/* ... thead ... */} 
           <tbody>
             {invoice.items.map((item: any) => (
               <tr key={item.id}>
                 <td>{item.description || item.item?.name}</td>
                 <td>{Number(item.quantity)}</td>
                 <td>{formatCurrency(item.unitPrice)}</td>
                 <td>{Number(item.vatRatePercent)}%</td>
                 <td>{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</td>
               </tr>
             ))}
             {/* ... Total Row ... */} 
           </tbody>
        </table>
      </div>

       {/* TODO: Payment History Section */}

      {/* Status Change Modal */} 
      {/* {showStatusModal && ( ... )} */}

      {/* Record Payment Modal */} 
      {/* {showPaymentModal && ( ... )} */}
      
       {error && <div className="p-4 text-red-500">Error: {error}</div>}
       {creditError && <div className="p-4 text-red-500">Error: {creditError}</div>}
    </div>
  );
} 