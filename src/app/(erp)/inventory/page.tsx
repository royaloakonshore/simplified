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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { data: queryData, error, isLoading, refetch: refetchInventoryList } = api.inventory.list.useQuery({});
  const { data: categoriesData } = api.inventory.getAllCategories.useQuery();

  const categoryOptions = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map(cat => ({ label: cat.name, value: cat.id }));
  }, [categoriesData]);

  const itemsForTable: InventoryItemRowData[] = useMemo(() => {
    if (!queryData?.data) return [];
    // queryData.data are items from api.inventory.list
    // These items already have base InventoryItem fields, with costPrice, salesPrice, etc., converted to string by the router.
    // InventoryItemRowData expects these string fields, and base InventoryItem fields for the rest (e.g. defaultVatRatePercent as Decimal).
    return queryData.data.map(apiItem => {
      return {
        ...apiItem, // This should provide most fields correctly aligned.
        // Ensure Date types for createdAt and updatedAt if they might be strings from JSON
        createdAt: new Date(apiItem.createdAt),
        updatedAt: new Date(apiItem.updatedAt),
        // itemType should be fine if router passes it as the enum or a compatible string
        // inventoryCategory from apiItem should match InventoryItemRowData.inventoryCategory
      } as InventoryItemRowData; // Cast is still useful for ensuring full type compatibility
    });
  }, [queryData]);

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

  // QR Code PDF Generation Mutation
  const generatePdfMutation = api.inventory.generateQrCodePdf.useMutation({
    onSuccess: (data) => {
      if (data.success && data.pdfBase64) {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inventory_qr_tags.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success(data.message);
        setRowSelection({});
      } else if (data.success) {
        toast.info(data.message);
      } else {
        toast.error(data.message || 'PDF generation failed for an unknown reason.');
      }
    },
    onError: (err) => {
      toast.error(`Failed to generate QR PDF: ${err.message}`);
    },
  });

  const selectedOriginalItemIds = useMemo(() => {
    return table.getSelectedRowModel().flatRows.map(row => (row.original as InventoryItemRowData).id);
  }, [table, rowSelection]);

  const handlePrintSelected = () => {
    if (selectedOriginalItemIds.length === 0) {
      toast.warn("No items selected to print.");
      return;
    }
    generatePdfMutation.mutate({ itemIds: selectedOriginalItemIds });
  };

  const handleDataChange = () => {
    refetchInventoryList();
  };

  if (isLoading && !queryData && !error) { // Adjusted loading check
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inventory Items</h1>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-32" /> 
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <InventoryPageSkeleton />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">Error loading inventory: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Items</h1>
        <div className="flex items-center space-x-2">
          {selectedOriginalItemIds.length > 0 && (
            <Button onClick={handlePrintSelected} variant="outline" disabled={generatePdfMutation.isLoading}>
              <PrinterIcon className="mr-2 h-4 w-4" />
              {generatePdfMutation.isLoading ? `Generating PDF (${selectedOriginalItemIds.length})...` : `Print QR Tags (${selectedOriginalItemIds.length})`}
            </Button>
          )}
          <Button asChild>
            <Link href="/inventory/add">Create New Item</Link>
          </Button>
        </div>
      </div>
      <InventoryTable 
        items={itemsForTable} 
        isLoading={isLoading && !queryData && !error} // Adjusted loading check
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
        onDataChange={handleDataChange}
        categoryOptions={categoryOptions} 
      /> 
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