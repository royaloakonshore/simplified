'use client';

import { useState } from 'react';
// import { useSearchParams, useRouter, usePathname } from 'next/navigation'; // Keep removed if not using URL state
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
  // Column, // Unused?
  // Row, // Unused?
  // CellContext, // Infer from ColumnDef
  // HeaderContext, // Infer from ColumnDef
  // ColumnFilter, // Unused?
  VisibilityState
} from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Eye } from "lucide-react";
import Link from "next/link";
import { keepPreviousData } from '@tanstack/react-query'; // Import for placeholderData

// Import base Prisma types and the runtime enum InvoiceStatus
import { type Invoice, type Customer, InvoiceStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Assuming these common components exist and handle their own imports/props correctly
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
import { Badge } from "@/components/ui/badge";
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton';
import { formatCurrency, formatDate } from '@/lib/utils'; // Assuming utils exist
import { Skeleton } from "@/components/ui/skeleton";
import { type Decimal } from "@prisma/client/runtime/library";

// 1. Define the precise data type for the table rows based on tRPC output
// Includes all Invoice fields + specific includes + mapped itemCount
type InvoiceTableRowData = Invoice & {
  itemCount: number;
  customer: { id: string; name: string } | null; 
  items: { id: string }[]; // Included for itemCount calculation, might be needed elsewhere
};

// 2. Define columns using the correct row data type
const columns: ColumnDef<InvoiceTableRowData>[] = [
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Invoice #
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "customer.name",
    header: "Customer",
    cell: ({ row }) => row.original.customer?.name ?? 'N/A',
  },
  {
    accessorKey: "invoiceDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Invoice Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatDate(row.getValue("invoiceDate") as Date),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Due Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatDate(row.getValue("dueDate") as Date),
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="text-right w-full justify-end"
      >
        Amount
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amountRaw = row.getValue("totalAmount");
      const amount = typeof amountRaw === 'object' && amountRaw !== null && 'toNumber' in amountRaw 
                     ? (amountRaw as Decimal).toNumber() 
                     : Number(amountRaw) || 0;
      const formatted = formatCurrency(amount);
      return <div className="text-right">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = row.getValue("status") as InvoiceStatus;
        // Correct Badge variant - use secondary for draft
        let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
        if (status === InvoiceStatus.paid) variant = "default";
        if (status === InvoiceStatus.overdue) variant = "destructive";
        if (status === InvoiceStatus.sent) variant = "outline";

        return <Badge variant={variant} className="capitalize">{status.toLowerCase().replace('_', ' ')}</Badge>;
    },
  },
  {
    accessorKey: "itemCount", // Display itemCount
    header: "Items",
    cell: ({ row }) => <div className="text-center">{row.original.itemCount}</div>,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(invoice.invoiceNumber)}
            >
              Copy Invoice #
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Link href={`/invoices/${invoice.id}`} passHref>
              <DropdownMenuItem>View Details</DropdownMenuItem>
            </Link>
            {invoice.customer?.id && (
               <Link href={`/customers/${invoice.customer.id}`} passHref>
                 <DropdownMenuItem>View Customer</DropdownMenuItem>
               </Link>
            )}
            {/* Add other actions like Edit, Credit, Delete later */}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// 4. Correctly type statusOptions for DataTableFacetedFilter
const statusOptions: { label: string; value: InvoiceStatus }[] = Object.values(InvoiceStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' '),
}));

// Props definition remains the same
interface InvoiceListContentProps {
  initialPage?: number;
  initialPerPage?: number;
  initialSearchTerm?: string;
  initialStatus?: InvoiceStatus | null;
  initialSortBy?: string;
  initialSortDirection?: 'asc' | 'desc';
}

export default function InvoiceListContent({
  initialPage = 1,
  initialPerPage = 10,
  initialSearchTerm = "",
  initialStatus = null,
  initialSortBy = 'invoiceDate',
  initialSortDirection = 'desc',
}: InvoiceListContentProps) {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [status, setStatus] = useState<InvoiceStatus | null>(initialStatus);
  const [sorting, setSorting] = useState<SortingState>([
    { id: initialSortBy, desc: initialSortDirection === 'desc' },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
      const filters: ColumnFiltersState = [];
      if(initialStatus) filters.push({ id: 'status', value: [initialStatus] });
      return filters;
  });

  const sortBy = sorting[0]?.id;
  const sortDirection = sorting[0]?.desc ? 'desc' : 'asc';

  // 5. Fix tRPC query input types
  const { data, isLoading, error, isFetching } = api.invoice.list.useQuery(
    {
      pagination: { page, perPage, sortBy, sortDirection },
      filters: {
        searchTerm: searchTerm || undefined,
        status: status ?? undefined,
      },
    },
    {
      // Use placeholderData from tanstack/react-query
      placeholderData: keepPreviousData,
    }
  );

  // 6. Derive pagination state directly from component state (no parseInt needed)
  const pagination: PaginationState = {
    pageIndex: page - 1,
    pageSize: perPage,
  };

  const table = useReactTable({
    data: data?.data ?? [], 
    columns, // Use columns defined with InvoiceTableRowData
    pageCount: data?.meta?.totalPages ?? -1,
    state: {
      sorting,
      pagination, // Use derived pagination state
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
       const newState = typeof updater === 'function' ? updater(pagination) : updater;
       setPage(newState.pageIndex + 1);
       setPerPage(newState.pageSize);
    },
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
    return <DataTableSkeleton columnCount={columns.length} rowCount={perPage} />;
  }

  // Error state
  if (error) {
    return <div className="text-red-600 p-4">Error loading invoices: {error.message}</div>;
  }

  // Render table
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
      <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
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
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
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