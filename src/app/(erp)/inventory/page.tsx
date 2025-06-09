"use client";

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, ArrowRight, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from '@/lib/trpc/react';
import { useRouter } from 'next/navigation';
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { type ItemType as PrismaItemType, type InventoryItem as PrismaInventoryItem } from '@prisma/client';

// Type reflecting InventoryItem after tRPC serialization (Decimals to strings)
type InventoryItemTRPCData = Omit<PrismaInventoryItem, 'minimumStockLevel' | 'reorderLevel' | 'costPrice' | 'salesPrice' | 'quantityOnHand' | 'defaultVatRatePercent' | 'inventoryCategory'> & {
  minimumStockLevel: string;
  reorderLevel: string | null;
  costPrice: string;
  salesPrice: string;
  quantityOnHand: string;
  defaultVatRatePercent: string | null;
  inventoryCategory: { id: string; name: string } | null;
};

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

function InventoryPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border rounded-md">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function InventoryListContent() {
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'createdAt' | 'costPrice' | 'quantityOnHand'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: inventoryData, isLoading, isFetching, error } = api.inventory.list.useQuery({
    page: 1,
    perPage: 50,
    sortBy,
    sortDirection,
    search: debouncedSearchTerm || undefined,
  });

  const filteredItems = React.useMemo(() => {
    if (!inventoryData?.data) return [];
    return inventoryData.data as InventoryItemTRPCData[];
  }, [inventoryData?.data]);

  const productCount = React.useMemo(() => {
    return filteredItems.filter(item => item.itemType === 'MANUFACTURED_GOOD').length;
  }, [filteredItems]);

  const rawMaterialCount = React.useMemo(() => {
    return filteredItems.filter(item => item.itemType === 'RAW_MATERIAL').length;
  }, [filteredItems]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 py-4 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              Total Items: {inventoryData?.meta?.totalCount || 0}
            </Badge>
            <Badge variant="outline">
              Products: {productCount}
            </Badge>
            <Badge variant="outline">
              Raw Materials: {rawMaterialCount}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="sku">SKU</SelectItem>
              <SelectItem value="createdAt">Date Created</SelectItem>
              <SelectItem value="costPrice">Cost</SelectItem>
              <SelectItem value="quantityOnHand">Quantity</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as typeof sortDirection)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A-Z</SelectItem>
              <SelectItem value="desc">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search inventory items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Loading Inventory</AlertTitle>
          <AlertDescription>{error.message || 'An unknown error occurred.'}</AlertDescription>
        </Alert>
      )}

      {isLoading || isFetching ? (
        <div className="space-y-4">
          <div className="border rounded-md">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ) : (
        <div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No inventory items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link href={`/inventory/${item.id}/edit`} className="hover:underline">
                          {item.name}
                        </Link>
                      </TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>
                        <Badge variant={item.itemType === 'RAW_MATERIAL' ? 'secondary' : 'default'}>
                          {item.itemType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.inventoryCategory ? (
                          <Badge variant="outline">
                            {item.inventoryCategory.name}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(item.salesPrice)}</TableCell>
                      <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                      <TableCell className="text-right">{item.quantityOnHand} {item.unitOfMeasure}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/inventory/${item.id}/edit`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              disabled
            >
              Next Page <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
    <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <PageBanner>
        <BannerTitle>Inventory Items</BannerTitle>
      </PageBanner>

      <div className="flex justify-between items-center mb-6">
        <div></div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/inventory/add">Add New Item</Link>
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Suspense fallback={<InventoryPageSkeleton />}>
        <InventoryListContent />
      </Suspense>
    </div>
  );
} 