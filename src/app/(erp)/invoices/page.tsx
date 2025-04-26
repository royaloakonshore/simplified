import { Suspense } from 'react';
import Link from 'next/link';
import { listInvoices } from '@/lib/actions/invoice.actions';
import InvoiceTable from '@/components/invoices/InvoiceTable';
import PaginationControls from '@/components/common/PaginationControls';
// import SearchFilter from '@/components/core/SearchFilter'; // Assuming this exists

// interface InvoicesPageProps {
//   searchParams: { [key: string]: string | string[] | undefined };
// }

export default async function InvoicesPage(props: any) {
  const searchParams = props.searchParams ?? {}; // Extract searchParams, default to empty object

  const page = parseInt(searchParams?.page as string || '1');
  const perPage = parseInt(searchParams?.perPage as string || '10');
  
  // TODO: Add proper parsing/validation for other searchParams like status, customerId, date ranges, searchTerm
  const params = {
    page,
    perPage,
    sortBy: searchParams?.sortBy as string || 'invoiceDate',
    sortDirection: searchParams?.sortDirection as 'asc' | 'desc' || 'desc',
    status: searchParams?.status as string,
    customerId: searchParams?.customerId as string,
    searchTerm: searchParams?.searchTerm as string,
    // Add fromDate, toDate later
  };

  // Fetch data
  const result = await listInvoices(params);

  if (!result.success || !result.data) {
    return <p className="text-red-500">Error loading invoices: {result.error || 'Unknown error'}</p>;
  }

  const { items: invoices, meta } = result.data;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Invoices</h1>
        <Link 
          href="/invoices/add" 
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Create Manual Invoice
        </Link>
      </div>

      {/* TODO: Add Filters (Status, Customer, Date Range) */}
      {/* <SearchFilter placeholder="Search invoice #, customer, notes..." /> */}

      <Suspense fallback={<div>Loading invoices...</div>}>
        <InvoiceTable 
          invoices={invoices} 
          totalCount={meta.totalCount}
          page={meta.page}
          perPage={meta.perPage}
          totalPages={meta.totalPages}
        />
      </Suspense>

      {meta.totalPages > 1 && (
        <PaginationControls
          currentPage={meta.page}
          totalPages={meta.totalPages}
          searchParams={searchParams}
          hasNextPage={meta.page < meta.totalPages}
          hasPrevPage={meta.page > 1}
        />
      )}
    </div>
  );
} 