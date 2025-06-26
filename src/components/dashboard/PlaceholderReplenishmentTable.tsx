"use client";

import * as React from "react";
import { api } from '@/lib/trpc/react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PlaceholderReplenishmentTable() {
  const { data: alerts, isLoading, error } = api.inventory.getReplenishmentAlerts.useQuery();

  if (isLoading) {
    return (
      <div className="h-64 w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-muted animate-pulse rounded" />
          <span className="text-sm text-muted-foreground">Loading replenishment alerts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 w-full rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">Error loading replenishment alerts</p>
        </div>
      </div>
    );
  }

  const rawMaterialAlerts = alerts?.filter(item => item.itemType === 'RAW_MATERIAL') || [];
  const criticalAlerts = rawMaterialAlerts.filter(item => {
    const reorderLevel = Number(item.reorderLevel || 0);
    return Number(item.quantityOnHand) <= reorderLevel;
  });

  const outOfStockAlerts = criticalAlerts.filter(item => Number(item.quantityOnHand) <= 0);
  const lowStockAlerts = criticalAlerts.filter(item => Number(item.quantityOnHand) > 0);

  if (criticalAlerts.length === 0) {
    return (
      <div className="h-64 w-full rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-white text-sm">✓</span>
          </div>
          <p className="text-sm text-green-700 font-medium">All Raw Materials In Stock</p>
          <p className="text-xs text-green-600">No replenishment alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-lg border overflow-auto">
      <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="font-medium text-sm">Critical Replenishment Alerts ({criticalAlerts.length})</span>
        </div>
        <Link href="/inventory/replenishment">
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-1 h-3 w-3" />
            View All
          </Button>
        </Link>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Material</TableHead>
            <TableHead className="w-[80px]">SKU</TableHead>
            <TableHead className="text-right w-[80px]">Stock</TableHead>
            <TableHead className="text-right w-[80px]">Reorder</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Show out of stock items first */}
          {outOfStockAlerts.slice(0, 3).map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-xs">
                <Link href={`/inventory/${item.id}`} className="hover:underline">
                  {item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{item.sku}</TableCell>
              <TableCell className="text-right text-xs text-red-600 font-semibold">
                0 {item.unitOfMeasure}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {item.reorderLevel ? Number(item.reorderLevel) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant="destructive" className="text-xs">
                  Out
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Then show low stock items */}
          {lowStockAlerts.slice(0, Math.max(0, 3 - outOfStockAlerts.length)).map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-xs">
                <Link href={`/inventory/${item.id}`} className="hover:underline">
                  {item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{item.sku}</TableCell>
              <TableCell className="text-right text-xs text-yellow-600 font-semibold">
                {Number(item.quantityOnHand)} {item.unitOfMeasure}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {item.reorderLevel ? Number(item.reorderLevel) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                  Low
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Show remaining count if there are more alerts */}
          {criticalAlerts.length > 3 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-2">
                +{criticalAlerts.length - 3} more critical alerts
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
} 