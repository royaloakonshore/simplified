"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PlaceholderReplenishmentTable() {
  return (
    <div className="h-64 w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 flex items-center justify-center overflow-auto">
      {/* <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item SKU</TableHead>
            <TableHead>Item Name</TableHead>
            <TableHead className="text-right">Current Stock</TableHead>
             <TableHead className="text-right">Alert Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              Replenishment Alerts Table Placeholder
            </TableCell>
          </TableRow>
        </TableBody>
      </Table> */}
      <p className="text-sm text-muted-foreground">Replenishment Alerts Table Placeholder</p>
    </div>
  );
} 