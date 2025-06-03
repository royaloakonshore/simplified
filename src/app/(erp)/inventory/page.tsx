'use client';

import { Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import React from 'react';
import { 
  type RowSelectionState, 
  useReactTable, 
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState, 
  type PaginationState,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel
} from "@tanstack/react-table";
import { PrinterIcon, EditIcon, PlusCircle, FileText, Loader2, Trash2, MoreHorizontal } from 'lucide-react';
import { toast } from "sonner";
import { type ItemType as PrismaItemType, type InventoryItem as PrismaInventoryItem } from '@prisma/client';
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { type Prisma } from '@prisma/client';
import { type ListInventoryItemsInput } from '@/lib/schemas/inventory.schema';
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/lib/api/root";
import { Decimal } from '@prisma/client/runtime/library';

// Type reflecting InventoryItem after tRPC serialization (Decimals to strings)
// Based on Prisma Schema: InventoryItem
type InventoryItemTRPCData = Omit<PrismaInventoryItem, 'minimumStockLevel' | 'reorderLevel' | 'costPrice' | 'salesPrice' | 'quantityOnHand' | 'defaultVatRatePercent' | 'inventoryCategory'> & {
  minimumStockLevel: string;
  reorderLevel: string | null;
  costPrice: string;
  salesPrice: string;
  quantityOnHand: string;
  defaultVatRatePercent: string | null;
  inventoryCategory: { id: string; name: string } | null; // Add explicitly as it's included in list query
};

// Type for what the table row expects for display and interaction
export interface InventoryItemRowData {
  id: string;
  sku: string | null;
  name: string;
  itemType?: PrismaItemType;
  quantityOnHand: string; // Prisma: Decimal -> TRPC: string
  costPrice: string;      // Prisma: Decimal -> TRPC: string
  salesPrice: string;     // Prisma: Decimal -> TRPC: string
  inventoryCategory: { id: string; name: string } | null;
  description?: string | null;
  unitOfMeasure?: string | null;
  minimumStockLevel: string; // Prisma: Decimal -> TRPC: string
  reorderLevel: string | null;   // Prisma: Decimal? -> TRPC: string | null
  defaultVatRatePercent?: string | null; // Prisma: Decimal? -> TRPC: string | null. Made optional for RowData.
  showInPricelist?: boolean | null;
  internalRemarks?: string | null;
  qrIdentifier?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  leadTimeDays?: number | null;
  vendorSku?: string | null;
  vendorItemName?: string | null;
  supplierId?: string | null;
  inventoryCategoryId?: string | null;
  companyId?: string | null;
}

// Skeleton for the inventory page
function InventoryPageSkeleton() {
  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-10 w-1/2 mx-auto" />
      </div>
    </div>
  );
}

// Component to handle fetching and displaying inventory data
function InventoryListContent() {
  const router = useRouter();
  const utils = api.useUtils();

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  // For editable QOH
  const [editingCell, setEditingCell] = useState<{rowIndex: number; columnId: string} | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [itemToUpdate, setItemToUpdate] = useState<{itemId: string; newQuantity: number; originalQuantity: number} | null>(null);

  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  const listInput = useMemo((): ListInventoryItemsInput => ({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sortBy: (sorting[0]?.id as ListInventoryItemsInput['sortBy']) ?? 'name',
    sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
    search: debouncedGlobalFilter || undefined,
    inventoryCategoryId: selectedCategory || undefined,
  }), [pagination, sorting, debouncedGlobalFilter, selectedCategory]);

  const { data: inventoryQueryResults, isLoading, error, refetch } = api.inventory.list.useQuery(
    listInput,
    { /* keepPreviousData: true, // Removed for now */ }
  );
  
  const { data: categoriesData } = api.inventory.getAllCategories.useQuery();

  const itemsForTable = React.useMemo(() => {
    // Force cast to InventoryItemTRPCData[] due to persistent TS inference issues with Decimal types from tRPC client.
    // The router-level logic stringifies Decimals, so this cast reflects the expected runtime shape.
    const sourceData: InventoryItemTRPCData[] = (inventoryQueryResults?.data as any as InventoryItemTRPCData[]) ?? [];
    
    return sourceData.map((item: InventoryItemTRPCData): InventoryItemRowData => ({
      // Mapping from InventoryItemTRPCData to InventoryItemRowData
      id: item.id,
      sku: item.sku,
      name: item.name,
      itemType: item.itemType,
      quantityOnHand: item.quantityOnHand,
      costPrice: item.costPrice,
      salesPrice: item.salesPrice,
      minimumStockLevel: item.minimumStockLevel,
      reorderLevel: item.reorderLevel,
      defaultVatRatePercent: item.defaultVatRatePercent,
      inventoryCategory: item.inventoryCategory,
      description: item.description,
      unitOfMeasure: item.unitOfMeasure,
      showInPricelist: item.showInPricelist,
      internalRemarks: item.internalRemarks,
      qrIdentifier: item.qrIdentifier,
      leadTimeDays: item.leadTimeDays,
      vendorSku: item.vendorSku,
      vendorItemName: item.vendorItemName,
      createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
      supplierId: item.supplierId,
      inventoryCategoryId: item.inventoryCategoryId,
      companyId: item.companyId,
    }));
  }, [inventoryQueryResults?.data]);

  const totalCount = React.useMemo(() => inventoryQueryResults?.meta?.totalCount ?? 0, [inventoryQueryResults]);
  const pageCount = React.useMemo(() => inventoryQueryResults?.meta?.totalPages ?? -1, [inventoryQueryResults]);

  const categoryOptions = React.useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map(cat => ({ value: cat.id, label: cat.name }));
  }, [categoriesData]);

  const quickUpdateQuantityMutation = api.inventory.quickAdjustStock.useMutation({
    onSuccess: (data) => { 
      const typedData = data as any as InventoryItemTRPCData;
      toast.success(`Stock for "${typedData.name}" updated to ${typedData.quantityOnHand}.`);
      utils.inventory.list.invalidate(listInput);
      setEditingCell(null);
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to update stock: ${error.message}`);
      setEditingCell(null);
    },
    onSettled: () => {
       setShowConfirmDialog(false);
       setItemToUpdate(null);
    }
  });
  
  const handleStartEdit = (rowIndex: number, columnId: string, currentValue: string | null) => {
    setEditingCell({ rowIndex, columnId });
    setEditValue(currentValue ?? "");
  };

  const handleSaveEdit = () => {
    if (editingCell && itemToUpdate) {
        const currentItem = itemsForTable[editingCell.rowIndex];
        const originalQty = parseFloat(currentItem.quantityOnHand || "0");

        setItemToUpdate({
            itemId: currentItem.id,
            newQuantity: parseFloat(editValue),
            originalQuantity: originalQty
        });
        setShowConfirmDialog(true);
    } else if (editingCell) {
        const currentItem = itemsForTable[editingCell.rowIndex];
        const originalQty = parseFloat(currentItem.quantityOnHand || "0");
        setItemToUpdate({
            itemId: currentItem.id,
            newQuantity: parseFloat(editValue),
            originalQuantity: originalQty
        });
        setShowConfirmDialog(true);
    }
  };
  
  const confirmUpdateQuantity = () => {
    if(itemToUpdate){
      quickUpdateQuantityMutation.mutate({
        itemId: itemToUpdate.itemId,
        newQuantityOnHand: itemToUpdate.newQuantity,
        originalQuantityOnHand: itemToUpdate.originalQuantity,
        note: null
      });
    }
  };

  const columns = React.useMemo<ColumnDef<InventoryItemRowData, any>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
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
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'inventoryCategory.name',
      header: 'Category',
      id: 'categoryName',
      cell: ({ row }) => {
        const category = row.original.inventoryCategory;
        return category ? <Badge variant="outline">{category.name}</Badge> : null;
      },
    },
    {
      accessorKey: 'quantityOnHand',
      header: 'Qty on Hand',
      cell: ({ row, column, getValue }) => {
        const isEditing = editingCell?.rowIndex === row.index && editingCell?.columnId === column.id;
        const initialValue = getValue<string | null>();

        if (isEditing) {
          return (
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                autoFocus
                className="h-8 w-20"
              />
            </div>
          );
        }
        return (
            <div onClick={() => handleStartEdit(row.index, column.id, initialValue)} className="cursor-pointer w-full h-full">
                {initialValue}
            </div>
        );
      }
    },
    { accessorKey: 'costPrice', header: 'Cost Price (€)' },
    { accessorKey: 'salesPrice', header: 'Sales Price (€)' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push(`/inventory/${row.original.id}/edit`)}>
              <EditIcon className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [editingCell, editValue, itemsForTable]);

  const table = useReactTable({
    data: itemsForTable,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    pageCount: pageCount,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    meta: {
    },
  });
  
  const selectedItemIds = useMemo(() => {
    return table.getSelectedRowModel().flatRows.map(row => row.original.id);
  }, [table, rowSelection]);

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItemRowData | null>(null);

  const deleteInventoryItemMutation = api.inventory.delete.useMutation({
    onSuccess: (data) => {
      toast.success(`Item deleted successfully.`);
      utils.inventory.list.invalidate();
      setRowSelection({});
      setShowDeleteConfirmation(false);
      setItemToDelete(null);
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to delete item: ${error.message}`);
      setShowDeleteConfirmation(false);
      setItemToDelete(null);
    },
  });

  const handleDeleteConfirmation = (item: InventoryItemRowData) => {
    setItemToDelete(item);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
    if (selectedRows.length === 0) {
      toast.info("No items selected for deletion.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected item(s)?`)) {
      selectedRows.forEach(item => {
        deleteInventoryItemMutation.mutate({ id: item.id });
      });
    }
  };

  if (error) return <div className="text-red-500 p-4">Error loading inventory: {error.message}</div>;

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Inventory Items</h1>
        <div className="flex items-center space-x-2">
            {selectedItemIds.length > 0 && (
                 <Button variant="outline" size="sm" onClick={handleDeleteSelected} /* disabled={deleteInventoryItemsMutation.isPending} */ >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedItemIds.length})
                    {/* {deleteInventoryItemsMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} */}
                </Button>
            )}
          <Button asChild size="sm">
            <Link href="/inventory/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 py-4 border-b">
        <Input
          placeholder="Search all columns..."
          value={globalFilter ?? ''}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm h-10 text-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value === "all" ? undefined : value)}>
            <SelectTrigger className="w-[180px] h-10 text-sm">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {isLoading && !inventoryQueryResults && (
         <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full rounded-md" />
            <div className="flex justify-center"><Skeleton className="h-10 w-64"/></div>
        </div>
      )}

      {!isLoading && inventoryQueryResults && itemsForTable.length === 0 && (
        <div className="text-center py-10">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No inventory items</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new inventory item.</p>
          <div className="mt-6">
            <Button asChild size="sm">
                <Link href="/inventory/add">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Link>
            </Button>
          </div>
        </div>
      )}

      {!isLoading && itemsForTable.length > 0 && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id} onClick={header.column.getToggleSortingHandler()}
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                            asc: ' ▲',
                            desc: ' ▼',
                        }[header.column.getIsSorted() as string] ?? null}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-center space-x-2 py-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </>
      )}

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirm Stock Update</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to update the quantity on hand to {editValue}?
                    This will create an adjustment transaction.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setEditingCell(null); setItemToUpdate(null); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmUpdateQuantity} disabled={quickUpdateQuantityMutation.isPending}>
                    {quickUpdateQuantityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Update
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}

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

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryPageSkeleton />}>
      <InventoryListContent />
    </Suspense>
  );
} 