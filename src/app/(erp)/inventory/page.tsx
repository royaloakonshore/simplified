"use client";

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, ArrowRight, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { InventoryTable, columns, type InventoryItemRowData } from '@/components/inventory/InventoryTable';
import { CreateCategoryDialog } from '@/components/inventory/CreateCategoryDialog';
import { ExcelImportExport } from '@/components/common/ExcelImportExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { formatCurrency } from '@/lib/utils';

// Custom hook for search debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function InventoryListContent() {
  const router = useRouter();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const debouncedSearchTerm = useDebounce(globalFilter, 300);

  // Fetch inventory data
  const { data: inventoryData, isLoading, error } = api.inventory.list.useQuery({
    page: 1,
    perPage: 100,
    search: debouncedSearchTerm || undefined,
  });

  // Fetch inventory categories for filtering  
  // Temporarily commented out due to tRPC type issues - will be fixed in build
  const categoriesData: any[] = []; // api.inventoryCategory.list.useQuery({});

  // Transform data for table
  const inventoryItems: InventoryItemRowData[] = React.useMemo(() => {
    if (!inventoryData?.data) return [];
    return inventoryData.data.map((item: any) => ({
      ...item,
      costPrice: item.costPrice,
      salesPrice: item.salesPrice,
      quantityOnHand: item.quantityOnHand,
      minimumStockLevel: item.minimumStockLevel,
      reorderLevel: item.reorderLevel,
      defaultVatRatePercent: item.defaultVatRatePercent?.toString() || null,
      dimensions: item.dimensions?.toString() || null,
      weight: item.weight?.toString() || null,
    }));
  }, [inventoryData?.data]);

  // Category options for filtering
  const categoryOptions = React.useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map(category => ({
      label: category.name,
      value: category.name,
    }));
  }, [categoriesData]);

  // Handle table data updates (for editable cells)
  const handleDataChange = React.useCallback((rowIndex: number, columnId: string, value: unknown) => {
    // This would typically trigger an update mutation
    console.log('Data change:', { rowIndex, columnId, value });
    // TODO: Implement actual update logic with tRPC mutation
  }, []);

  // Table configuration
  const table = useReactTable({
    data: inventoryItems,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: {
      onDataChange: handleDataChange,
    },
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load inventory items: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const selectedItems = table.getFilteredSelectedRowModel().rows;
  const totalItems = inventoryData?.meta?.totalCount || 0;
  const productCount = inventoryItems.filter(item => item.itemType === 'MANUFACTURED_GOOD').length;
  const rawMaterialCount = inventoryItems.filter(item => item.itemType === 'RAW_MATERIAL').length;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex items-center space-x-4 py-4 border-b">
        <div className="flex items-center space-x-2">
          <div className="text-sm font-medium">Total Items: {totalItems}</div>
          <div className="text-sm text-muted-foreground">Products: {productCount}</div>
          <div className="text-sm text-muted-foreground">Raw Materials: {rawMaterialCount}</div>
          {selectedItems.length > 0 && (
            <div className="text-sm font-medium text-blue-600">
              {selectedItems.length} selected
            </div>
          )}
        </div>
      </div>

      {/* Advanced Table */}
      <InventoryTable
        table={table}
        isLoading={isLoading}
        onDataChange={handleDataChange}
        categoryOptions={categoryOptions}
      />

      {/* Bulk Actions for Selected Items */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
          </span>
          <Button variant="outline" size="sm">
            Export Selected
          </Button>
          <Button variant="outline" size="sm">
            Bulk Edit
          </Button>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <div className="w-full">
      <PageBanner>
        <BannerTitle>Inventory Management</BannerTitle>
      </PageBanner>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/pricelist">
              <ArrowRight className="mr-2 h-4 w-4" />
              View Price List
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/replenishment">
              <Settings className="mr-2 h-4 w-4" />
              Replenishment
            </Link>
          </Button>
          <CreateCategoryDialog />
        </div>

        <Button asChild>
          <Link href="/inventory/add">Add New Item</Link>
        </Button>
      </div>

      {/* Excel Import/Export Section */}
      <div className="mb-6">
        <ExcelImportExport
          title="Inventory Data Management"
          description="Export current inventory to Excel or import bulk updates from Excel files with comprehensive validation."
          exportEndpoint="/api/excel/export/inventory"
          exportFileName="inventory-export.xlsx"
          allowImport={true}
          showPreview={true}
          onImportSuccess={() => {
            // This would refresh the inventory data
            window.location.reload();
          }}
        />
      </div>

      <Suspense fallback={<div>Loading inventory...</div>}>
        <InventoryListContent />
      </Suspense>
    </div>
  );
} 