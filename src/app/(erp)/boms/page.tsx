'use client'; // This page will use hooks for data fetching

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BOMTable } from "@/components/boms/BOMTable";
import { api } from "@/lib/trpc/react";
import { PlusCircle } from "lucide-react";

export default function BillOfMaterialsPage() {
  // TODO: Replace placeholder companyId with actual companyId from session/context
  const companyIdPlaceholder = "clxjv0l1s0000108kjrdy1z4h"; // Example CUID, replace!

  const { data: boms, isLoading, error } = api.bom.list.useQuery({
    companyId: companyIdPlaceholder, 
    // manufacturedItemId: undefined // Optional: filter by a specific manufactured item
  });

  if (error) {
    return (
      <div className="container mx-auto py-10 text-red-600">
        <p>Error loading Bill of Materials: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Bill of Materials</h1>
        <Button asChild>
          <Link href="/boms/add">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New BOM
          </Link>
        </Button>
      </div>
      <BOMTable data={boms || []} isLoading={isLoading} />
    </div>
  );
} 