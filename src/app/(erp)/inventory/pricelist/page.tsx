'use client';

import React from 'react';
import { api } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import PriceListTable, { type PriceListItemRowData } from '@/components/inventory/PriceListTable';
import { PageBanner, BannerTitle } from '@/components/ui/page-banner';

export default function PriceListPage() {
  // Fetch inventory items filtered by showInPricelist = true
  const { data: inventoryData, isLoading, error } = api.inventory.list.useQuery({
    perPage: 100, // Maximum allowed by schema - for larger inventories, implement pagination
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
    showInPricelist: true, // Only show items marked for price list
  });

  // Fetch categories for filtering
  const { data: categoriesData } = api.inventoryCategory.list.useQuery({});

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <PageBanner>
          <BannerTitle>Price List</BannerTitle>
        </PageBanner>
        <p className="text-red-600">Error loading price list: {error.message}</p>
      </div>
    );
  }

  // Map inventory items to price list format (excluding quantity and UOM columns)
  const priceListItems: PriceListItemRowData[] = inventoryData?.data?.map(item => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    itemType: item.itemType,
    salesPrice: item.salesPrice,
    inventoryCategory: item.inventoryCategory,
    variant: item.variant,
    showInPricelist: item.showInPricelist,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })) || [];

  // Map categories for filtering
  const categoryOptions = categoriesData?.map(category => ({
    label: category.name,
    value: category.id,
  })) || [];

  return (
    <div className="container mx-auto py-10">
      <PageBanner>
        <div className="flex justify-between items-center">
          <BannerTitle>Price List</BannerTitle>
          <Button variant="outline" disabled className="text-white border-white hover:bg-white/20">
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </PageBanner>

      {inventoryData?.meta?.totalCount && inventoryData.meta.totalCount > 100 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Showing first 100 items of {inventoryData.meta.totalCount} total. 
            Consider implementing pagination for complete price list.
          </p>
        </div>
      )}

      <PriceListTable 
        data={priceListItems}
        isLoading={isLoading}
        categoryOptions={categoryOptions}
      />
    </div>
  );
} 