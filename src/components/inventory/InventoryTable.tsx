'use client';

import * as React from "react";
import { type InventoryItem, MaterialType } from "@prisma/client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
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
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
}

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

export const columns: ColumnDef<InventoryItem>[] = [
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
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => <div className="font-mono">{row.getValue("sku")}</div>,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "unitOfMeasure",
    header: "UoM",
  },
  {
    accessorKey: "costPrice",
    header: () => <div className="text-right">Cost Price</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("costPrice") || "0");
      return <div className="text-right">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "salesPrice",
    header: () => <div className="text-right">Sales Price</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("salesPrice") || "0");
      return <div className="text-right">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "materialType",
    header: "Type",
    cell: ({ row }) => {
      const type: MaterialType = row.getValue("materialType");
      return (
        <Badge variant={type === MaterialType.manufactured ? "default" : "secondary"}>
          {formatMaterialType(type)}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <Link href={`/inventory/${item.id}/edit`} passHref>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
      );
    },
  },
];

export function InventoryTable({ items, isLoading, rowSelection, setRowSelection }: InventoryTableProps) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {[...Array(columns.length)].map((_, i) => (
              <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              {[...Array(columns.length)].map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
              ))}
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
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
    </div>
  );
} 