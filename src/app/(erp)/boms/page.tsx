'use client'; // This page will use hooks for data fetching

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BOMTable } from "@/components/boms/BOMTable";
import { api } from "@/lib/trpc/react";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";

export default function BillOfMaterialsPage() {
  const { data: bomsResponse, isLoading, error } = api.bom.list.useQuery({});

  if (error) return <p>Error loading BOMs: {error.message}</p>;

  return (
    <div className="container mx-auto py-10">
      <PageBanner>
        <BannerTitle>Bill of Materials</BannerTitle>
      </PageBanner>

      <div className="flex justify-between items-center mb-8">
        <div></div>
        <Button asChild>
          <Link href="/boms/add">Add New BOM</Link>
        </Button>
      </div>

      <BOMTable data={bomsResponse?.data || []} isLoading={isLoading} />
    </div>
  );
} 