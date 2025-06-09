'use client';

import * as React from "react";
// import { api } from "@/lib/trpc/react"; // No longer directly needed for type inference here
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
import Link from "next/link";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

// Use inferRouterOutputs for more robust type inference
type RouterOutput = inferRouterOutputs<AppRouter>;
export type BOMTableRow = RouterOutput["bom"]["list"]["data"][number];

export const columns: ColumnDef<BOMTableRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
      >
        Total Cost
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("totalCalculatedCost") as string); // Prisma Decimal to number
      const formatted = amount.toFixed(2); // Just show the number with 2 decimal places, no currency symbol
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
  // Add other props like pagination state and handlers if implementing client-side pagination
}

export function BOMTable({ data, isLoading }: BOMTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // For client-side pagination
    state: {
      sorting,
    },
  });

  if (isLoading) {
    return <div>Loading BOMs...</div>; // Replace with a proper skeleton loader
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-4">No Bill of Materials found.</div>;
  }

  return (
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
      {/* Basic Pagination (optional, can be enhanced) */}
      <div className="flex items-center justify-end space-x-2 py-4 px-2">
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
  );
} 