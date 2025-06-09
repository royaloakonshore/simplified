'use client';

import React from 'react';
import { api } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ItemType } from '@prisma/client';
import { Skeleton } from '@/components/ui/skeleton';
import { FileDown } from 'lucide-react';

const formatItemType = (type: ItemType) => {
  switch (type) {
    case ItemType.RAW_MATERIAL:
      return "Raw Material";
    case ItemType.MANUFACTURED_GOOD:
      return "Manufactured Good";
    default:
      return type;
  }
};

export default function PriceListPage() {
  const { data: inventoryData, isLoading, error } = api.inventory.list.useQuery({
    perPage: 100, // Maximum allowed by schema - for larger inventories, implement pagination
    page: 1,
    sortBy: 'name',
    sortDirection: 'asc',
    // Note: We'll filter client-side for showInPricelist since the schema doesn't expose it in list query yet
  });

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-3xl font-bold mb-8">Price List</h1>
        <p className="text-red-600">Error loading price list: {error.message}</p>
      </div>
    );
  }

  const pricelistItems = inventoryData?.data?.filter((_item) => {
    // Since showInPricelist might not be in the list query response, 
    // we'll show all items for now and note this as a TODO to fix the filter
    return true; // TODO: Filter by item.showInPricelist when available in list query
  }) || [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Price List</h1>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {inventoryData?.meta?.totalCount && inventoryData.meta.totalCount > 100 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Showing first 100 items of {inventoryData.meta.totalCount} total. 
            Consider implementing pagination for complete price list.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Sales Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricelistItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No items available for price list.
                  </TableCell>
                </TableRow>
              ) : (
                pricelistItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.sku || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.itemType === ItemType.MANUFACTURED_GOOD ? "default" : "secondary"}>
                        {formatItemType(item.itemType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.inventoryCategory?.name || 'N/A'}
                    </TableCell>
                    <TableCell>{item.unitOfMeasure || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(parseFloat(item.salesPrice || '0'))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
} 