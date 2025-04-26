"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { InvoiceStatus } from '@/lib/types/invoice.types'; // Using local type
import { Prisma } from '@prisma/client'; // For Decimal

// Remove explicit payload type - rely on inference from parent page
// type InvoiceFromList = Prisma.InvoiceGetPayload<{ ... }>

interface InvoiceTableProps {
  invoices: any[]; // Use 'any' for now - parent page needs to pass correctly typed data
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  totalCount,
  page,
  perPage,
  totalPages,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentSort = searchParams.get('sortBy') || 'invoiceDate';
  const currentDirection = searchParams.get('sortDirection') || 'desc';
  
  // Status badge color mapping (using local enum keys)
  const statusColors: Record<string, string> = {
    [InvoiceStatus.DRAFT]: 'bg-neutral-200 text-neutral-800',
    [InvoiceStatus.SENT]: 'bg-blue-100 text-blue-800',
    [InvoiceStatus.PAID]: 'bg-green-100 text-green-800',
    [InvoiceStatus.OVERDUE]: 'bg-red-100 text-red-800',
    [InvoiceStatus.CANCELLED]: 'bg-neutral-400 text-neutral-800',
    [InvoiceStatus.CREDITED]: 'bg-gray-400 text-gray-800',
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fi-FI');
  };

  const formatCurrency = (amount: number | Prisma.Decimal | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    const num = typeof amount === 'number' ? amount : Number(amount);
    return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(num);
  };

  const handleSort = (column: string) => {
    let direction = 'asc';
    if (currentSort === column && currentDirection === 'asc') {
      direction = 'desc';
    }
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', column);
    params.set('sortDirection', direction);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md overflow-hidden shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              {/* Invoice # */}
              <th scope="col" className="..." onClick={() => handleSort('invoiceNumber')}>Invoice #</th>
              {/* Customer */}
              <th scope="col" className="...">Customer</th>
              {/* Status */}
              <th scope="col" className="..." onClick={() => handleSort('status')}>Status</th>
              {/* Total */}
              <th scope="col" className="..." onClick={() => handleSort('totalAmount')}>Total</th>
              {/* Invoice Date */}
              <th scope="col" className="..." onClick={() => handleSort('invoiceDate')}>Invoice Date</th>
              {/* Due Date */}
              <th scope="col" className="..." onClick={() => handleSort('dueDate')}>Due Date</th>
              {/* Actions */}
              <th scope="col" className="...">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
            {invoices.length === 0 ? (
              <tr><td colSpan={7}>No invoices found</td></tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  {/* Invoice # */}
                  <td><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td>
                  {/* Customer */}
                  <td>{invoice.customer?.name || '-'}</td>
                  {/* Status */}
                  <td>
                    <span className={`... ${statusColors[invoice.status]}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  {/* Total */}
                  <td>{formatCurrency(invoice.totalAmount)}</td>
                  {/* Invoice Date */}
                  <td>{formatDate(invoice.invoiceDate)}</td>
                   {/* Due Date */}
                  <td>{formatDate(invoice.dueDate)}</td>
                  {/* Actions */}
                  <td>
                    <Link href={`/invoices/${invoice.id}`} className="...">View</Link>
                    {/* Add Edit/Delete based on status later if needed */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination Component (similar to OrderTable) */}
      {/* ... */}
    </div>
  );
}

export default InvoiceTable; 