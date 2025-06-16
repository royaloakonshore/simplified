'use client'; // This page will use hooks for data fetching

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BOMTable } from "@/components/boms/BOMTable";
import { api } from "@/lib/trpc/react";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { toast } from "sonner";

export default function BillOfMaterialsPage() {
  const { data: bomsResponse, isLoading, error } = api.bom.list.useQuery({});

  // Bulk action handlers
  const handleBulkDelete = (selectedIds: string[]) => {
    // TODO: Implement with tRPC mutation
    console.log("Bulk delete BOMs:", selectedIds);
    toast.success(`Bulk delete for ${selectedIds.length} BOMs - Implementation pending`);
  };

  const handleBulkExport = (selectedIds: string[]) => {
    // TODO: Implement bulk export functionality
    console.log("Bulk export BOMs:", selectedIds);
    toast.success(`Bulk export for ${selectedIds.length} BOMs - Implementation pending`);
  };

  if (error) return <p>Error loading BOMs: {error.message}</p>;

  return (
    <div className="w-full">
      <PageBanner>
        <BannerTitle>Bill of Materials</BannerTitle>
      </PageBanner>

      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button asChild>
          <Link href="/boms/add">Add New BOM</Link>
        </Button>
      </div>

      <BOMTable 
        data={bomsResponse?.data || []} 
        isLoading={isLoading}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        showBulkActions={true}
      />
    </div>
  );
} 