'use client';

import * as React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/lib/api/root"; // Import AppRouter type
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  RowSelectionState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { ArrowUpDown, MoreHorizontal, Download, Search, Filter, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Use inferRouterOutputs for more robust type inference
type RouterOutput = inferRouterOutputs<AppRouter>;
export type BOMTableRow = RouterOutput["bom"]["list"]["data"][number];

export const columns: ColumnDef<BOMTableRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-auto p-0 font-semibold text-left"
      >
        BOM Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "manufacturedItem.inventoryCategory.name",
    header: "Category",
    cell: ({ row }) => {
      const category = row.original.manufacturedItem?.inventoryCategory?.name;
      return category ? (
        <Badge variant="outline">{category}</Badge>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
  },
  {
    accessorKey: "manufacturedItem.name", // Assuming nested object structure
    header: "Manufactured Item",
    cell: ({ row }) => row.original.manufacturedItem?.name || "N/A",
  },
  {
    accessorKey: "manufacturedItem.sku", // Assuming nested object structure
    header: "Manufactured SKU",
    cell: ({ row }) => row.original.manufacturedItem?.sku || "N/A",
  },
  {
    accessorKey: "_count.items", // From include: { _count: { select: { items: true } } }
    header: "Components",
    cell: ({ row }) => row.original._count?.items ?? 0,
  },
  {
    accessorKey: "totalCalculatedCost",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="h-auto p-0 font-semibold"
      >
        Total Cost
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = row.getValue("totalCalculatedCost");
      // Convert Prisma Decimal to number safely
      const numericAmount = typeof amount === 'object' && amount !== null && 'toNumber' in amount 
        ? (amount as any).toNumber() 
        : Number(amount);
      const formatted = new Intl.NumberFormat('fi-FI', {
        style: 'currency',
        currency: 'EUR',
      }).format(numericAmount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const bom = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/boms/${bom.id}`}>View Details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/boms/${bom.id}/edit`}>Edit BOM</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // TODO: Implement delete functionality with confirmation
                console.log("Delete BOM:", bom.id);
                alert(`Placeholder: Delete BOM ${bom.name}?`);
              }}
              className="text-red-600"
            >
              Delete BOM
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface BOMTableProps {
  data: BOMTableRow[];
  isLoading: boolean;
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkExport?: (selectedIds: string[]) => void;
  showBulkActions?: boolean;
}

export function BOMTable({ 
  data, 
  isLoading, 
  onBulkDelete,
  onBulkExport,
  showBulkActions = false 
}: BOMTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState<string>("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      globalFilter,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map(row => row.original.id);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select BOMs to delete.");
      return;
    }
    if (onBulkDelete) {
      onBulkDelete(selectedIds);
    } else {
      // TODO: Implement default bulk delete
      toast.success(`Deleting ${selectedIds.length} BOMs - Implementation pending`);
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select BOMs to export.");
      return;
    }
    if (onBulkExport) {
      onBulkExport(selectedIds);
    } else {
      // TODO: Implement default bulk export
      toast.success(`Exporting ${selectedIds.length} BOMs - Implementation pending`);
    }
  };

  if (isLoading) {
    return <div>Loading BOMs...</div>; // Replace with a proper skeleton loader
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-4">No Bill of Materials found.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search BOMs..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="pl-8"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {showBulkActions && selectedIds.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-md">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} BOM{selectedIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Export ({selectedIds.length})
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}

    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {/* Enhanced Pagination */}
      <div className="flex items-center justify-between space-x-2 py-4 px-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
            of {table.getFilteredRowModel().rows.length} results
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
} 