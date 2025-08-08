'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  VisibilityState,
  type Column,
  type Row,
} from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Download, FileText, Bell, FileDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from '@/components/ui/input';
import { ReminderInvoiceDialog } from '@/components/invoices/ReminderInvoiceDialog';

// Import base Prisma types and the runtime enum InvoiceStatus
import { type Invoice, type Customer, InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';

import { DataTablePagination } from '@/components/common/DataTablePagination';
import { DataTableFacetedFilter } from '@/components/common/DataTableFacetedFilter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { type Decimal } from "@prisma/client/runtime/library";

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Helper component for table headers
function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>;
  title: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

// Helper component for row actions
// Forward declaration for InvoiceTableRowData
declare global {
  interface InvoiceTableRowData extends Invoice {
    customer: Pick<Customer, 'id' | 'name'>;
    items: { id: string }[];
    totalAmount: Decimal;
    totalVatAmount: Decimal;
    customerId: string;
    penaltyInterest: Decimal | null;
    dueDate: Date;
    isReminder: boolean;
  }
}

function DataTableRowActions<TData extends { id: string }>({
  row,
}: {
  row: Row<TData>;
}) {
  const invoice = row.original as unknown as InvoiceTableRowData;
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  
  // Only show reminder option for sent invoices that are not reminders themselves
  const canCreateReminder = invoice.status === PrismaInvoiceStatus.sent && !invoice.isReminder;
  
  const handlePdfExport = async () => {
    try {
      const response = await fetch(`/api/pdf/invoice/${invoice.id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoice.id}`}>View Details</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>Edit Invoice</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handlePdfExport}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </DropdownMenuItem>
          {canCreateReminder && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowReminderDialog(true)}
                className="flex items-center gap-2"
              >
                <Bell className="h-4 w-4" />
                Create Reminder
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => console.log("Delete invoice", invoice.id)}
            className="text-red-600"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {canCreateReminder && (
        <ReminderInvoiceDialog
          open={showReminderDialog}
          onOpenChange={setShowReminderDialog}
          invoice={{
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: Number(invoice.totalAmount),
            penaltyInterest: invoice.penaltyInterest ? Number(invoice.penaltyInterest) : null,
            dueDate: invoice.dueDate.toISOString(),
            customerId: invoice.customerId,
          }}
        />
      )}
    </>
  );
}

// Helper component for status badge
function InvoiceStatusBadge({ status }: { status: PrismaInvoiceStatus }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  switch (status) {
    case PrismaInvoiceStatus.paid:
      variant = "default";
      break;
    case PrismaInvoiceStatus.sent:
      variant = "default";
      break;
    case PrismaInvoiceStatus.overdue:
    case PrismaInvoiceStatus.cancelled:
      variant = "destructive";
      break;
    case PrismaInvoiceStatus.draft:
    case PrismaInvoiceStatus.credited:
      variant = "secondary";
      break;
    default:
      variant = "outline";
  }
  return <Badge variant={variant} className="capitalize">{status.replace("_", " ")}</Badge>;
}

// Bulk Actions Toolbar Component
interface InvoiceBulkActionsProps {
  selectedRows: Row<InvoiceTableRowData>[];
  onClearSelection: () => void;
}

function InvoiceBulkActions({ selectedRows, onClearSelection }: InvoiceBulkActionsProps) {
  const handleBulkPdfExport = () => {
    // TODO: Implement bulk PDF export functionality
    const selectedInvoiceIds = selectedRows.map(row => row.original.id);
    console.log('Exporting PDFs for invoices:', selectedInvoiceIds);
    // This will be a placeholder for now - in a real implementation:
    // 1. Call a tRPC mutation that generates PDFs for multiple invoices
    // 2. Download a ZIP file containing all PDFs
    // 3. Show loading state and success/error feedback
    alert(`PDF export for ${selectedInvoiceIds.length} invoices will be implemented soon!`);
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-blue-50 border-b border-blue-200">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm font-medium text-blue-900">
          {selectedRows.length} invoice{selectedRows.length === 1 ? '' : 's'} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleBulkPdfExport}
          size="sm"
          variant="outline"
          className="h-8"
        >
          <Download className="mr-2 h-4 w-4" />
          Export PDFs
        </Button>
        <Button
          onClick={onClearSelection}
          size="sm"
          variant="ghost"
          className="h-8"
        >
          Clear selection
        </Button>
      </div>
    </div>
  );
}


// 1. Define the precise data type for the table rows based on tRPC output
type InvoiceTableRowData = {
  id: string;
  invoiceNumber: string;
  status: PrismaInvoiceStatus;
  invoiceDate: Date;
  dueDate: Date;
  totalAmount: Decimal;
  totalVatAmount: Decimal;
  customerId: string;
  isReminder: boolean;
  penaltyInterest: Decimal | null;
  customer: Pick<Customer, 'id' | 'name'>;
  items: { id: string }[];
};

// 2. Define columns using the correct row data type
const columns: ColumnDef<InvoiceTableRowData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice #" />,
    cell: ({ row }) => <Link
      href={`/invoices/${row.original.id}`}
      className="hover:underline">
      {row.getValue("invoiceNumber")}
    </Link>
  },
  {
    accessorKey: "customer.name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => row.original.customer.name
  },
  {
    accessorKey: "invoiceDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => formatDate(row.getValue("invoiceDate") as Date)
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
    cell: ({ row }) => formatDate(row.getValue("dueDate") as Date)
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Net Amount" />,
    cell: ({ row }) => formatCurrency(row.getValue("totalAmount") as Decimal)
  },
  {
    accessorKey: "totalVatAmount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="VAT" />,
    cell: ({ row }) => formatCurrency(row.getValue("totalVatAmount") as Decimal)
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <InvoiceStatusBadge status={row.getValue("status") as PrismaInvoiceStatus} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];

// 4. Correctly type statusOptions for DataTableFacetedFilter
const statusOptions: { label: string; value: PrismaInvoiceStatus }[] = Object.values(PrismaInvoiceStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' '),
}));

// Props definition remains the same
interface InvoiceListContentProps {
  initialPage?: number;
  initialPerPage?: number;
  initialSearchTerm?: string;
  initialStatus?: PrismaInvoiceStatus | undefined; // Allow undefined here
  initialSortBy?: string;
  initialSortDirection?: 'asc' | 'desc';
}

export default function InvoiceListContent({
  initialPage = 1,
  initialPerPage = 10,
  initialSearchTerm = "",
  initialStatus = undefined, // Default to undefined
  initialSortBy = 'invoiceDate',
  initialSortDirection = 'desc',
}: InvoiceListContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for immediate input value
  const [currentSearchTerm, setCurrentSearchTerm] = useState(initialSearchTerm);
  // Debounced search term for API calls and URL updates
  const debouncedSearchTerm = useDebounce(currentSearchTerm, 500); // 500ms debounce

  const [statusFilter, /* setStatusFilter */] = useState<PrismaInvoiceStatus | undefined>(initialStatus); // setStatusFilter will be marked as unused and removed by commenting out
  const [sorting, setSorting] = useState<SortingState>([
    { id: initialSortBy, desc: initialSortDirection === 'desc' },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: initialPage - 1, pageSize: initialPerPage });

  // const createQueryString = useCallback( // This function will be removed
  //   (params: Record<string, string | number | null>) => {
  //     const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
  //     Object.entries(params).forEach(([name, value]) => {
  //       if (value === null || value === undefined || String(value).trim() === '') {
  //         currentParams.delete(name);
  //       } else {
  //         currentParams.set(name, String(value));
  //       }
  //     });
  //     return currentParams.toString();
  //   },
  //   [searchParams]
  // );

  // useEffect(() => { // This useEffect block might be the one using currentStatus
  //   const currentStatus = searchParams.get('status') as PrismaInvoiceStatus | null;
  //   if (currentStatus && Object.values(PrismaInvoiceStatus).includes(currentStatus)) {
  //     setStatusFilter(currentStatus);
  //   } else if (!currentStatus) {
  //     setStatusFilter(undefined);
  //   }
  // }, [searchParams, setStatusFilter]);

  // If currentStatus was only used in the useEffect above, which refers to setStatusFilter, 
  // and setStatusFilter is now partly unused (setStatus is commented), this whole useEffect might be removable or need refactoring.
  // For now, just commenting out currentStatus if its definition is simple and isolated.
  // const currentStatus = searchParams.get('status') as PrismaInvoiceStatus | null; // Example, will find actual line from context

  // Effect to update URL when filters/pagination/sorting change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', (pagination.pageIndex + 1).toString());
    params.set('perPage', pagination.pageSize.toString());
    params.set('sortBy', sorting[0]?.id ?? initialSortBy);
    params.set('sortDirection', sorting[0]?.desc ? 'desc' : 'asc');
    if (debouncedSearchTerm) {
      params.set('searchTerm', debouncedSearchTerm);
    } else {
      params.delete('searchTerm');
    }
    if (statusFilter) {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pagination, debouncedSearchTerm, statusFilter, sorting, router, pathname, searchParams, initialSortBy]);

  // Effect to parse URL params on mount and update state
  useEffect(() => {
    const currentPage = parseInt(searchParams.get('page') || initialPage.toString(), 10);
    const currentPerPage = parseInt(searchParams.get('perPage') || initialPerPage.toString(), 10);
    const currentSortBy = searchParams.get('sortBy') || initialSortBy;
    const currentSortDirection = searchParams.get('sortDirection') === 'desc' ? 'desc' : 'asc';
    const currentSearch = searchParams.get('searchTerm') || initialSearchTerm;
    // const currentStatusParam = searchParams.get('status') as PrismaInvoiceStatus | undefined; // Part of currentStatus logic to be removed
    // const currentStatus = currentStatusParam ?? initialStatus; // This variable will be removed

    setPagination({ pageIndex: currentPage - 1, pageSize: currentPerPage });
    setSorting([{ id: currentSortBy, desc: currentSortDirection === 'desc' }]);
    setCurrentSearchTerm(currentSearch);
    // setStatusFilter(currentStatus); // This line would use setStatusFilter, which is being removed
    setColumnVisibility({});
  }, [searchParams, initialPage, initialPerPage, initialSortBy, initialSortDirection, initialSearchTerm, initialStatus]);

  const { data, isLoading, error } = api.invoice.list.useQuery({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sortBy: sorting[0]?.id,
    sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
    searchTerm: debouncedSearchTerm,
    status: statusFilter,
  }, {
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: (resp) => resp,
  });

  const table = useReactTable({
    data: data?.data ?? [], 
    columns, // Use columns defined with InvoiceTableRowData
    pageCount: data?.meta?.totalPages ?? -1,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    debugTable: process.env.NODE_ENV === 'development',
  });

  // Loading state
  if (isLoading && !data) {
    return <DataTableSkeleton columnCount={columns.length} rowCount={pagination.pageSize} />;
  }

  // Error state
  if (error) {
    return <div className="text-red-600 p-4">Error loading invoices: {error.message}</div>;
  }

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Input
                placeholder="Filter invoices (Num, Customer, Notes)..."
                value={currentSearchTerm}
                onChange={(event) => setCurrentSearchTerm(event.target.value)}
                className="max-w-sm"
            />
            <div className="flex items-center space-x-2">
                    <DataTableFacetedFilter
                        column={table.getColumn('status')}
                        title="Status"
                        options={statusOptions}
                    />
            </div>
        </div>
        {selectedRows.length > 0 && (
          <InvoiceBulkActions 
            selectedRows={selectedRows} 
            onClearSelection={() => table.toggleAllPageRowsSelected(false)}
          />
        )}
        <div className="rounded-md border overflow-x-auto">
            <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap" style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </TableHead>
                  ))}
                </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap" style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
        <DataTablePagination table={table} />
    </div>
  );
} 