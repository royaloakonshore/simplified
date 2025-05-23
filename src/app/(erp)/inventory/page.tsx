'use client';

import { Suspense, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from "@/lib/trpc/react";
import { InventoryTable, columns } from '@/components/inventory/InventoryTable';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import React from 'react';
import { type RowSelectionState, useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { PrinterIcon } from 'lucide-react';
import { toast } from 'react-toastify';

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
  const utils = api.useUtils();

  const { data, error, isLoading } = api.inventory.list.useQuery({});

  const table = useReactTable({
    data: data?.items ?? [],
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
        // Create a blob from the base64 PDF data
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'inventory_qr_tags.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href); // Clean up

        toast.success(data.message);
        setRowSelection({}); // Clear selection
      } else if (data.success) { // Successful but no PDF data
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
    return table.getSelectedRowModel().flatRows.map(row => row.original.id);
  }, [table, rowSelection]); // Depend on table instance and rowSelection

  const handlePrintSelected = () => {
    if (selectedOriginalItemIds.length === 0) {
      toast.warn("No items selected to print.");
      return;
    }
    generatePdfMutation.mutate({ itemIds: selectedOriginalItemIds });
  };

  if (error) {
    return <div className="text-red-600">Error loading inventory: {error.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Items</h1>
        <div className="flex items-center space-x-2">
          {selectedOriginalItemIds.length > 0 && (
            <Button onClick={handlePrintSelected} variant="outline" disabled={generatePdfMutation.isPending}>
              <PrinterIcon className="mr-2 h-4 w-4" />
              {generatePdfMutation.isPending ? `Generating PDF (${selectedOriginalItemIds.length})...` : `Print QR Tags (${selectedOriginalItemIds.length})`}
            </Button>
          )}
          <Button asChild>
            <Link href="/inventory/add">Create New Item</Link>
          </Button>
        </div>
      </div>
      <InventoryTable 
        items={data?.items ?? []} 
        isLoading={isLoading && !data && !error}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
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