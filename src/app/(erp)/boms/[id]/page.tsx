'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Edit, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function ViewBillOfMaterialPage() {
  const params = useParams();
  const bomId = typeof params.id === 'string' ? params.id : '';

  const { data: bomData, isLoading, error } = api.bom.get.useQuery(
    { id: bomId },
    { enabled: !!bomId }
  );

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load Bill of Material: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-96" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!bomData) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            Bill of Material not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalComponentCost = bomData.items.reduce((total, item) => {
    // We don't have the component cost directly here, so we'll note this limitation
    return total;
  }, 0);

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/boms">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to BOMs
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Assembly Instructions</h1>
            <p className="text-muted-foreground">{bomData.name}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/boms/${bomId}/edit`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit BOM
          </Link>
        </Button>
      </div>

      <div className="grid gap-6">
        {/* BOM Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Bill of Material Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">BOM Name</label>
                <p className="font-medium">{bomData.name}</p>
              </div>
              {bomData.description && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="font-medium">{bomData.description}</p>
                </div>
              )}
            </div>
            
            {bomData.manufacturedItem && (
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground">Manufactured Item</label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default">Manufactured</Badge>
                  <span className="font-medium">{bomData.manufacturedItem.name}</span>
                  {bomData.manufacturedItem.sku && (
                    <span className="text-muted-foreground">({bomData.manufacturedItem.sku})</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Component List - Assembly Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Required Components
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Components needed to assemble one unit of the final product
            </p>
          </CardHeader>
          <CardContent>
            {bomData.items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No components defined for this BOM.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component SKU</TableHead>
                    <TableHead>Component Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Quantity Required</TableHead>
                    <TableHead>Variant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {item.componentItem.sku || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.componentItem.name}
                      </TableCell>
                      <TableCell>
                        {item.componentItem.inventoryCategory?.name ? (
                          <Badge variant="outline">
                            {item.componentItem.inventoryCategory.name}
                          </Badge>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        {item.componentItem.unitOfMeasure || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell>
                        {item.componentItem.variant ? (
                          <Badge variant="outline">{item.componentItem.variant}</Badge>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cost Information */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Manual Labor Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(bomData.manualLaborCost)}</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Component Count</p>
                <p className="text-2xl font-bold">{bomData.items.length}</p>
              </div>
              <div className="text-center p-4 border rounded-lg bg-primary/5">
                <p className="text-sm text-muted-foreground">Total Calculated Cost</p>
                <p className="text-2xl font-bold">{bomData.totalCalculatedCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Including materials + labor
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 