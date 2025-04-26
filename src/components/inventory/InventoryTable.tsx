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
    // TODO: Replace with Shadcn Skeleton Loader
    return <div>Loading...</div>;
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