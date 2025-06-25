'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/ui/data-table-pagination"; 
import { CustomerEditDialog } from './CustomerEditDialog';
import { api } from '@/lib/trpc/react'; 

import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { 
    MoreHorizontal,
    FileText,
    FilePlus,
    FileBox,
    Edit,
    User,
} from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";

interface CustomerTableProps {
  customers: Customer[];
}

const CustomerTableRowActions = ({ customer, onEditSuccess }: { customer: Customer, onEditSuccess: () => void }) => {
  const router = useRouter();

  const handleCreateDocument = (customerId: string, type: 'invoice' | 'quotation' | 'work_order') => {
    const baseUrl = type === 'invoice' ? '/invoices/add' : '/orders/add';
    const params = new URLSearchParams({ customerId });
    if (type !== 'invoice') {
      params.set('orderType', type === 'quotation' ? 'QUOTATION' : 'WORK_ORDER');
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const handleViewProfile = (customerId: string) => {
    router.push(`/customers/${customerId}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleViewProfile(customer.id)}>
            <User className="mr-2 h-4 w-4" />
            <span>View Profile</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleCreateDocument(customer.id, 'invoice')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Create Invoice</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateDocument(customer.id, 'quotation')}>
            <FilePlus className="mr-2 h-4 w-4" />
            <span>Create Quotation</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateDocument(customer.id, 'work_order')}>
            <FileBox className="mr-2 h-4 w-4" />
            <span>Create Work Order</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <CustomerEditDialog
            customerId={customer.id}
            onSuccess={onEditSuccess}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit Customer</span>
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default function CustomerTable({ customers }: CustomerTableProps) {
  const utils = api.useUtils(); // Correct: Hook called at the top level
  const router = useRouter();

  const columns = React.useMemo<ColumnDef<Customer>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
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
          <CustomerTableRowActions 
            customer={row.original} 
            onEditSuccess={() => utils.customer.list.invalidate()} 
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ], [utils]); // Added utils to dependency array
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data: customers, 
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={(e) => {
                    // Only navigate if the click is not on the checkbox or actions column
                    const target = e.target as HTMLElement;
                    if (!target.closest('[data-no-click]') && !target.closest('button') && !target.closest('[role="checkbox"]')) {
                      router.push(`/customers/${row.original.id}`);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      {...(cell.column.id === 'select' || cell.column.id === 'actions' ? { 'data-no-click': true } : {})}
                    >
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