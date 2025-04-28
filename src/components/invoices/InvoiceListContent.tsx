'use client';

import { useState } from 'react';
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
  Column,
  Row,
  CellContext,
  HeaderContext,
  ColumnFilter
} from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Invoice, Customer, Order, InvoiceStatus } from '@prisma/client'; // Use generated types
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// Combine types for the table data
type InvoiceWithRelations = Invoice & {
  customer: Customer | null;
  order: { orderNumber: string } | null;
};

// Define columns for the DataTable
const columns: ColumnDef<InvoiceWithRelations>[] = [
  {
    accessorKey: "invoiceNumber",
    header: ({ column }: HeaderContext<InvoiceWithRelations, unknown>) => (
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
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => row.original.customer?.name ?? 'N/A',
    filterFn: (row: Row<InvoiceWithRelations>, id: string, value: any): boolean => {
        const rowValue = row.getValue(id) as string;
        return value.includes(rowValue);
    }
  },
  {
    accessorKey: "order.orderNumber",
    header: "Order #",
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => row.original.order?.orderNumber ?? 'N/A',
  },
  {
    accessorKey: "invoiceDate",
    header: ({ column }: HeaderContext<InvoiceWithRelations, unknown>) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Invoice Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => formatDate(row.getValue("invoiceDate") as Date),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }: HeaderContext<InvoiceWithRelations, unknown>) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Due Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => formatDate(row.getValue("dueDate") as Date),
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }: HeaderContext<InvoiceWithRelations, unknown>) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="text-right w-full justify-end"
      >
        Amount
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => (
      <div className="text-right font-medium">
        {formatCurrency(row.getValue("totalAmount") as number | string)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => {
        const status = row.getValue("status") as InvoiceStatus;
        // Basic status badge - can be enhanced
        let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
        if (status === InvoiceStatus.paid) variant = "default"; // Use success color later
        if (status === InvoiceStatus.overdue) variant = "destructive";
        if (status === InvoiceStatus.sent) variant = "outline";

        return <Badge variant={variant} className="capitalize">{status.toLowerCase().replace('_', ' ')}</Badge>;
    },
    filterFn: (row: Row<InvoiceWithRelations>, id: string, value: any): boolean => {
        const rowValue = row.getValue(id) as string;
        return value.includes(rowValue);
    },
  },
  {
    id: "actions",
    cell: ({ row }: CellContext<InvoiceWithRelations, unknown>) => {
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
            <DropdownMenuItem>View customer</DropdownMenuItem> // TODO: Link to customer page
            <DropdownMenuItem>View invoice details</DropdownMenuItem> // TODO: Link to invoice details page
            <DropdownMenuItem>View order</DropdownMenuItem> // TODO: Link to order page
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// TODO: Replace with actual data fetch or better type
const statusOptions = Object.values(InvoiceStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' '),
}));

export default function InvoiceListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read state from URL
  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('perPage') ?? '10';
  const sort = searchParams.get('sort');
  const [sortBy, sortDirection] = sort?.split('.') ?? ['invoiceDate', 'desc'];
  const globalFilter = searchParams.get('search') ?? '';
  const statusFilter = searchParams.get('status');
  // TODO: Add customer filter if needed

  const [sorting, setSorting] = useState<SortingState>([
    { id: sortBy, desc: sortDirection === 'desc' },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
      const filters: ColumnFiltersState = [];
      if(statusFilter) filters.push({ id: 'status', value: statusFilter.split(',') });
      // Add other initial filters from URL if needed
      return filters;
  });
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: parseInt(page) - 1,
    pageSize: parseInt(perPage),
  });

  // Debounce mechanism for global filter
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState(globalFilter);
  // TODO: Implement proper debouncing if performance is an issue

  // Update URL when state changes
  const createQueryString = (params: Record<string, string | number | null>) => {
    const newSearchParams = new URLSearchParams(searchParams?.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    }
    return newSearchParams.toString();
  };

  const handlePaginationChange = (updater: any) => {
    setPagination((old) => {
      const newState = typeof updater === 'function' ? updater(old) : updater;
      router.push(
        `${pathname}?${createQueryString({ page: newState.pageIndex + 1, perPage: newState.pageSize })}`,
        { scroll: false }
      );
      return newState;
    });
  };

  const handleSortingChange = (updater: any) => {
    setSorting((old) => {
        const newState = typeof updater === 'function' ? updater(old) : updater;
        const sortParam = newState.length > 0 ? `${newState[0].id}.${newState[0].desc ? 'desc' : 'asc'}` : null;
        router.push(
            `${pathname}?${createQueryString({ sort: sortParam, page: 1 })}`,
            { scroll: false }
        );
        setPagination(prev => ({...prev, pageIndex: 0})); // Reset page index on sort
        return newState;
    });
  };

  const handleColumnFiltersChange = (updater: any) => {
    setColumnFilters((old) => {
        const newState = typeof updater === 'function' ? updater(old) : updater;
        const statusValues = newState.find((f: ColumnFilter) => f.id === 'status')?.value as string[] | undefined;
        router.push(
            `${pathname}?${createQueryString({ status: statusValues?.join(',') || null, page: 1 })}`,
            { scroll: false }
        );
        setPagination(prev => ({...prev, pageIndex: 0})); // Reset page index on filter
        return newState;
    });
  };

  const handleGlobalFilterChange = (value: string) => {
      setDebouncedGlobalFilter(value);
      // Apply filter to URL immediately (or debounce)
      router.push(
          `${pathname}?${createQueryString({ search: value || null, page: 1 })}`,
          { scroll: false }
      );
      setPagination(prev => ({...prev, pageIndex: 0})); // Reset page index on search
  }


  // Fetch data using tRPC hook
  const { data, isLoading, error } = api.invoice.list.useQuery(
    {
      pagination: {
        page: pageIndex + 1,
        perPage: pageSize,
        sortBy: sorting.length > 0 ? sorting[0].id : undefined,
        sortDirection: sorting.length > 0 ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
      },
      filters: {
        // Combine global filter and column filters as needed by backend
        searchTerm: debouncedGlobalFilter || undefined,
        status: columnFilters.find((f: ColumnFilter) => f.id === 'status')?.value as InvoiceStatus | undefined,
        // customerId: columnFilters.find((f: ColumnFilter) => f.id === 'customer.name')?.value as string | undefined,
      },
    },
  );

  const table = useReactTable({
    data: data?.invoices ?? [], // Provide default empty array
    columns,
    pageCount: data?.pagination?.totalPages ?? -1, // -1 indicates unknown page count
    state: {
      sorting,
      columnFilters,
      pagination: { pageIndex, pageSize },
      globalFilter: debouncedGlobalFilter,
    },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true, // Server-side pagination
    manualSorting: true, // Server-side sorting
    manualFiltering: true, // Server-side filtering
  });

  if (isLoading && !data) {
      // Use skeleton matching column definition and expected rows
      return <DataTableSkeleton columnCount={columns.length} rowCount={pageSize} showHeader={true} />;
  }

  if (error) {
    return <div className="text-red-600">Error loading invoices: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Input
                placeholder="Search invoices..."
                value={debouncedGlobalFilter}
                onChange={(event) => handleGlobalFilterChange(event.target.value)}
                className="max-w-sm"
            />
            <div className="flex items-center space-x-2">
                {table.getColumn('status') && (
                    <DataTableFacetedFilter
                        column={table.getColumn('status')}
                        title="Status"
                        options={statusOptions}
                    />
                )}
                {/* Add customer filter if needed */}
            </div>
        </div>
        <div className="rounded-md border">
            <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                    return (
                        <TableHead key={header.id}>
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </TableHead>
                    );
                    })}
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
                        <TableCell key={cell.id}>
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