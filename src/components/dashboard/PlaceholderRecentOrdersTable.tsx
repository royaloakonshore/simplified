"use client";

import * as React from "react";
// Removed unused table component imports
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";

export function PlaceholderRecentOrdersTable() {
  return (
    <div className="h-64 w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 flex items-center justify-center overflow-auto">
      {/* <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              Recent Orders Table Placeholder
            </TableCell>
          </TableRow>
        </TableBody>
      </Table> */}
      <p className="text-sm text-muted-foreground">Recent Orders Table Placeholder</p>
    </div>
  );
} 