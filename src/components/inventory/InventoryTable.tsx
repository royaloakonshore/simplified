'use client';

import * as React from "react";
import { type InventoryItem, MaterialType } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // Import Badge
import { formatCurrency } from "@/lib/utils"; // Assuming a currency formatter exists
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

interface InventoryTableProps {
  items: InventoryItem[]; // TODO: Include quantityOnHand later
  isLoading: boolean;
  // TODO: Add pagination props
}

// Helper function to format MaterialType
const formatMaterialType = (type: MaterialType) => {
  switch (type) {
    case MaterialType.raw_material:
      return "Raw Material";
    case MaterialType.manufactured:
      return "Manufactured";
    default:
      return type;
  }
};

export function InventoryTable({ items, isLoading }: InventoryTableProps) {
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className="h-5 w-20" /></TableHead>
            <TableHead><Skeleton className="h-5 w-40" /></TableHead>
            <TableHead><Skeleton className="h-5 w-16" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-5 w-24" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-5 w-24" /></TableHead>
            <TableHead><Skeleton className="h-5 w-28" /></TableHead>
            <TableHead><Skeleton className="h-5 w-20" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!items || items.length === 0) {
    return <div>No inventory items found.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Name</TableHead>
          {/* <TableHead>Quantity</TableHead> */}
          <TableHead>UoM</TableHead>
          <TableHead className="text-right">Cost Price</TableHead>
          <TableHead className="text-right">Sales Price</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-mono">{item.sku}</TableCell>
            <TableCell className="font-medium">{item.name}</TableCell>
            {/* <TableCell>TODO</TableCell> */}
            <TableCell>{item.unitOfMeasure}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.salesPrice)}</TableCell>
            <TableCell>
                <Badge variant={item.materialType === MaterialType.manufactured ? "default" : "secondary"}>
                    {formatMaterialType(item.materialType)}
                </Badge>
            </TableCell>
            <TableCell>
              <Link href={`/inventory/${item.id}/edit`} passHref>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
              {/* Add Delete button later */}
              {/* Add Adjust Stock button later */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    // TODO: Add pagination controls
  );
} 