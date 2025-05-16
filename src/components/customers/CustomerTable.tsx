'use client';

import React from 'react';
import { 
    ColumnDef, 
    flexRender, 
    getCoreRowModel, 
    useReactTable, 
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
    type FilterFn, // For custom filter functions if needed
} from "@tanstack/react-table";
import { type Customer } from '@prisma/client';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
// import Link from 'next/link'; // No longer directly needed for edit button
import { DataTablePagination } from "@/components/ui/data-table-pagination"; 
import { CustomerEditDialog } from './CustomerEditDialog'; // Import the dialog
import { api } from '@/lib/trpc/react'; // Import tRPC api for utils

// New Data Table Components
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";

// Define columns dynamically to use hooks within
const DynamicColumns = () => {
  const utils = api.useUtils();

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => <div>{row.getValue("email")}</div>,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Phone" />
      ),
      cell: ({ row }) => <div>{row.getValue("phone")}</div>,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <CustomerEditDialog 
            customerId={row.original.id} 
            trigger={<Button variant="outline" size="sm">Edit</Button>}
            onSuccess={() => {
              utils.customer.list.invalidate(); 
            }}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
  return columns;
}

interface CustomerTableProps {
  customers: Customer[]; // This will be the initial full dataset for client-side processing
  // Pagination is now handled client-side by TanStack table if we pass all data
  // Or server-side if we continue to fetch paginated data.
  // For this refactor, let's assume client-side processing for simplicity first.
  // If server-side pagination/filtering is kept, the table state needs to be lifted.
}

export default function CustomerTable({ customers }: CustomerTableProps) {
  const columns = React.useMemo(() => DynamicColumns(), []);
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({}); // If row selection is needed

  const table = useReactTable({
    data: customers, // Use the full customer list
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      // pagination will be managed by the table if we don't set manualPagination
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // For client-side pagination
    getFacetedRowModel: getFacetedRowModel(), // For faceted filters
    getFacetedUniqueValues: getFacetedUniqueValues(), // For faceted filters
    // enableGlobalFilter: true, // default is true
  });

  return (
    <div className="space-y-4">
      <DataTableToolbar 
        table={table} 
        globalFilter={globalFilter} 
        setGlobalFilter={setGlobalFilter} 
      />
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No customers found.
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