'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { ArrowUpDown, MoreHorizontal, Eye, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from '@/components/ui/input';

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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { DataTableSkeleton } from '@/components/common/DataTableSkeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";
import { type Decimal } from "@prisma/client/runtime/library";

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
  }
}

function DataTableRowActions<TData extends { id: string }>({
  row,
}: {
  row: Row<TData>;
}) {
  const invoice = row.original as unknown as InvoiceTableRowData;
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
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoice.id}`}>View Details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoice.id}/edit`}>Edit Invoice</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => console.log("Delete invoice", invoice.id)}
          className="text-red-600"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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


// 1. Define the precise data type for the table rows based on tRPC output
export type InvoiceTableRowData = Invoice & {
  customer: Pick<Customer, 'id' | 'name'>;
  items: { id: string }[]; // Assuming we only need item count or similar from items array for the list view
  totalAmount: Decimal;
  totalVatAmount: Decimal;
  // status: PrismaInvoiceStatus; // Already part of Invoice type
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
    cell: ({ row }) => <Link href={`/invoices/${row.original.id}`} className="hover:underline">{row.getValue("invoiceNumber")}</Link>
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
  initialStatus?: PrismaInvoiceStatus | null;
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
  const [status, setStatus] = useState<PrismaInvoiceStatus | null>(initialStatus);
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const queryInput = useMemo(() => {
    const currentSortById: string | undefined = sorting[0]?.id;
    let currentSortDirectionValue: 'asc' | 'desc' | undefined = undefined;
    if (sorting[0]) {
      currentSortDirectionValue = sorting[0].desc ? 'desc' : 'asc';
    }

    return {
      page,
      perPage: perPage,
      searchTerm: debouncedSearchTerm,
      status: status ?? undefined,
      sortBy: currentSortById,
      sortDirection: currentSortById ? currentSortDirectionValue : undefined,
    };
  }, [page, perPage, debouncedSearchTerm, status, sorting]);

  const { data, isLoading, error, refetch, isFetching } = api.invoice.list.useQuery(
    queryInput
  );

  // Hooks must be called before any conditional returns.
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

  const selectedOriginalInvoiceIds = useMemo(() => {
    return table.getSelectedRowModel().flatRows.map(row => row.original.id);
  }, [table]); // Pass table as dependency

  // Loading state
  if (isLoading && !data) {
    return <DataTableSkeleton columnCount={columns.length} rowCount={perPage} />;
  }

  // Error state
  if (error) {
    return <div className="text-red-600 p-4">Error loading invoices: {error.message}</div>;
  }


  const handleStatusFilterChange = (status: PrismaInvoiceStatus | null) => {
    setStatus(status);
    setPage(1); // Reset to first page on filter change
  };

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Input
                placeholder="Search invoices..."
              value={searchTerm}
              onChange={(event) => {
                const currentParams = new URLSearchParams(searchParams.toString());
                currentParams.set('search', event.target.value);
                currentParams.set('page', '1'); // Reset to page 1 on search
                router.push(`${pathname}?${currentParams.toString()}`);
              }}
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