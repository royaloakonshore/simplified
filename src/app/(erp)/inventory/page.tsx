'use client';

import { Suspense, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from "@/lib/trpc/react";
import { InventoryTable, columns, type InventoryItemRowData } from '@/components/inventory/InventoryTable';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import React from 'react';
import { type RowSelectionState, useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { PrinterIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { type ItemType } from '@prisma/client';
import { type TRPCClientErrorLike } from '@trpc/react-query';
import { type AppRouter } from '@/lib/api/root';
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender, type ColumnDef } from "@tanstack/react-table";
import { EditIcon } from 'lucide-react';
import { buttonVariants } from "@/components/ui/button";
import { type ColumnFiltersState, type SortingState, type PaginationState } from "@tanstack/react-table";
import { PlusCircle, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type Prisma } from '@prisma/client';

// Define ColumnMeta type locally if not imported
// type ColumnMeta = { isNumeric?: boolean }; // Removed as it's not standard and not used after refactor

// Define a type for your inventory item data if not already done
// ... existing code ...

// Type for category options
// ... existing code ...

// Skeleton for the inventory page
function InventoryPageSkeleton() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// Component to handle fetching and displaying inventory data
function InventoryListContent() {
  const router = useRouter();
  const utils = api.useUtils(); // Added utils
  const { data: initialData, isLoading: initialLoading, error: initialError } = api.inventory.list.useQuery(
    {},
    {
      refetchOnWindowFocus: false, // prevent excessive refetching
    }
  );
  const { data: categoriesData } = api.inventory.getAllCategories.useQuery();

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const items = React.useMemo(() => initialData?.data ?? [], [initialData]);
  const totalCount = React.useMemo(() => initialData?.meta?.totalCount ?? 0, [initialData]);
  // const totalPages = React.useMemo(() => initialData?.totalPages ?? 0, [initialData]);

  // This will hold transformed data for the table if needed (e.g. stringifying Decimals)
  const itemsForTable = React.useMemo(() => {
    return (items ?? []).map(item => ({
      ...item,
      costPrice: item.costPrice?.toString() ?? '',
      salesPrice: item.salesPrice?.toString() ?? '',
      quantityOnHand: item.quantityOnHand?.toString() ?? '', // This should align with InventoryItemRowData expecting string
      minimumStockLevel: item.minimumStockLevel?.toString() ?? '', // Align with InventoryItemRowData
      reorderLevel: item.reorderLevel?.toString() ?? null,
      // economicOrderQuantity removed as it's not in InventoryItem or InventoryItemRowData
      inventoryCategory: item.inventoryCategory ? { id: item.inventoryCategory.id, name: item.inventoryCategory.name } : null,
    })) as InventoryItemRowData[];
  }, [items]);
  
  const categoryOptions = React.useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map(cat => ({ value: cat.id, label: cat.name }));
  }, [categoriesData]);

  const updateInventoryItem = api.inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      toast.success("Inventory item updated successfully.");
    },
    onError: (error) => {
      toast.error("Failed to update item: " + error.message);
    }
  });
  
  const deleteInventoryItem = api.inventory.delete.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setRowSelection({}); // Clear selection
      toast.success("Inventory item deleted successfully.");
    },
    onError: (error) => {
      toast.error("Error deleting item: " + error.message);
    }
  });

  const handleDataChange = (rowIndex: number, columnId: string, value: any) => {
    // This function is a placeholder as its original implementation was tied to a 'meta' object in columns
    // that has been removed. If inline editing is a desired feature, this needs to be re-implemented 
    // using table.options.meta to pass and access this function.
    console.log("Data change attempt:", { rowIndex, columnId, value });
    toast.info("Inline editing not fully implemented in this view.");
  };
  
  // Removed local ColumnMeta type as it's not standard for Tanstack Table v8 column definitions
  // and the properties were not being used in a way that affects table behavior directly.
  // If custom properties are needed for cells/headers, they should be added to table.options.meta.

  const columns = React.useMemo<ColumnDef<InventoryItemRowData, any>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
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
      accessorKey: 'sku',
      header: 'SKU',
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'quantityOnHand',
      header: 'Qty on Hand',
      meta: { isNumeric: true },
    },
    {
      accessorKey: 'costPrice',
      header: 'Cost Price',
       meta: { isNumeric: true },
    },
    {
      accessorKey: 'salesPrice',
      header: 'Sales Price',
       meta: { isNumeric: true },
    },
    {
      accessorKey: 'inventoryCategory.name',
      header: 'Category',
      id: 'categoryName', 
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Link href={`/inventory/${row.original.id}/edit`} className={buttonVariants({ variant: "ghost" })}>
          <EditIcon className="h-4 w-4" />
        </Link>
      ),
    },
  ], [categoryOptions]); // Added categoryOptions to dependency array

  const table = useReactTable({
    data: itemsForTable, 
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedOriginalItemIds = useMemo(() => {
    // Now `table` is defined
    return table.getSelectedRowModel().flatRows.map(row => (row.original as InventoryItemRowData).id);
  }, [table, rowSelection]);

  if (initialLoading) return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Inventory Items</h1>
      <div>Loading...</div>
    </div>
  );
  // Commenting out DataTableSkeleton as it was causing issues.
  // if (initialLoading) return <DataTableSkeleton columnCount={columns.length} />;

  if (initialError) return <p>Error loading inventory: {initialError.message}</p>;
  if (!initialData) return <p>No inventory data found.</p>;

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="space-x-2">
           <Button onClick={() => router.push('/inventory/add')} variant="default">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
        </div>
      </div>

      <InventoryTable
        table={table}
        isLoading={initialLoading}
        onDataChange={handleDataChange}
        categoryOptions={categoryOptions}
      />

      {/* Delete Confirmation Dialog */}
      {/* {Object.keys(table.getState().rowSelection).length > 0 && (
        <div className="mt-4">
          <Button onClick={() => deleteInventoryItem.mutate({ ids: selectedOriginalItemIds })} variant="destructive">
            Delete Selected Items
          </Button>
        </div>
      )} */}
    </div>
  );
}

// Main page component
export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryPageSkeleton />}>
      <InventoryListContent />
    </Suspense>
  );
} 