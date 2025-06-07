'use client'; // This page will use hooks for data fetching

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BOMTable } from "@/components/boms/BOMTable";
import { api } from "@/lib/trpc/react";

const DUMMY_COMPANY_ID = "clxjv0l1s0000108kjrdy1z4h"; // Replace with actual company ID from session or context

export default function BillOfMaterialsPage() {
  const { data: bomsResponse, isLoading, error } = api.bom.list.useQuery(
    { companyId: DUMMY_COMPANY_ID } // Using defined DUMMY_COMPANY_ID, removed keepPreviousData
  );

  if (error) return <p>Error loading BOMs: {error.message}</p>;

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Bill of Materials</h1>
        <Button asChild>
          <Link href="/boms/add">Add New BOM</Link>
        </Button>
      </div>
      <BOMTable data={bomsResponse?.data || []} isLoading={isLoading} />
    </div>
  );
} 