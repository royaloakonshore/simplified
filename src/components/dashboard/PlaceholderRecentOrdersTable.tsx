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

// This component is deprecated - the dashboard page now uses its own RecentOrdersTable implementation
// This file is kept for backward compatibility but should be removed in future cleanup

export function DeprecatedRecentOrdersTable() {
  return (
    <div className="h-64 w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 flex items-center justify-center overflow-auto">
      <p className="text-sm text-muted-foreground">Deprecated - Use RecentOrdersTable in dashboard page</p>
    </div>
  );
}

// Keep old export for backward compatibility
export function PlaceholderRecentOrdersTable() {
  return <DeprecatedRecentOrdersTable />;
} 