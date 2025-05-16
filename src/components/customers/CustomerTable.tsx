'use client';

import React from 'react';
import { 
    ColumnDef, 
    flexRender, 
    getCoreRowModel, 
    useReactTable, 
    getPaginationRowModel 
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

// Define columns
const DynamicColumns = () => {
  const utils = api.useUtils(); // Hook for tRPC utils

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>, // Optional: Align header
      cell: ({ row }) => (
        <div className="text-right">
          <CustomerEditDialog 
            customerId={row.original.id} 
            trigger={<Button variant="outline" size="sm">Edit</Button>}
            onSuccess={() => {
              utils.customer.list.invalidate(); // Invalidate customer list on success
            }}
          />
        </div>
      ),
    },
  ];
  return columns;
}

interface CustomerTableProps {
  customers: Customer[];
  pagination: {
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
  };
  // Add callback for pagination changes if needed
}

export default function CustomerTable({ customers, pagination }: CustomerTableProps) {
  const columns = DynamicColumns(); // Get columns from the hook-enabled function
  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // Use built-in pagination
    manualPagination: true, // Tell table pagination is handled server-side
    pageCount: pagination.totalPages,
    state: {
      pagination: {
        pageIndex: pagination.page - 1, // TanStack Table is 0-indexed
        pageSize: pagination.perPage,
      },
    },
    // onPaginationChange: // Function to update URL search params (passed from page)
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
      {/* Reusable Pagination Component */}
       <DataTablePagination table={table} />
    </div>
  );
} 