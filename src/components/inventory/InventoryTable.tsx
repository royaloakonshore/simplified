'use client';

import * as React from "react";
import { type InventoryItem, ItemType } from "@prisma/client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
  ColumnFiltersState,
  VisibilityState,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type Table as ReactTableType,
  type Column,
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
import EditableQuantityCell from "./EditableQuantityCell";
import { api } from "@/lib/trpc/react";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";

// Define a more specific type for items in the table
// Omit original Decimal fields from InventoryItem, then add them as strings
export type InventoryItemRowData = Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'minimumStockLevel' | 'reorderLevel'> & { 
  quantityOnHand: string; 
  costPrice: string; 
  salesPrice: string; 
  minimumStockLevel: string; 
  reorderLevel: string | null; 
  // inventoryCategory is already included from base InventoryItem if the `include` in Prisma query is correct
  // If inventoryCategory is NOT on base InventoryItem or needs specific typing for the row:
  inventoryCategory: { id: string; name: string } | null; 
};

interface InventoryTableProps {
  items: InventoryItemRowData[]; 
  isLoading: boolean;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  onDataChange: () => void;
  categoryOptions: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

const formatItemType = (type: ItemType) => {
  switch (type) {
    case ItemType.RAW_MATERIAL:
      return "Raw Material";
    case ItemType.MANUFACTURED_GOOD:
      return "Manufactured Good";
    default:
      return type;
  }
};

export const columns: ColumnDef<InventoryItemRowData>[] = [
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
      const amount = parseFloat(row.getValue("costPrice") || "0"); // Now receives string
      return <div className="text-right">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "salesPrice",
    header: () => <div className="text-right">Sales Price</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("salesPrice") || "0"); // Now receives string
      return <div className="text-right">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "quantityOnHand",
    header: () => <div className="text-right">Qty on Hand</div>,
    cell: ({ row, table }) => {
      const itemWithStrQty = row.original as InventoryItemRowData;
      const meta = table.options.meta as { onDataChange?: () => void };
      // EditableQuantityCell now expects item.quantityOnHand to be a string
      return <EditableQuantityCell item={itemWithStrQty} onUpdate={meta?.onDataChange ?? (() => {})} />;
    },
  },
  {
    accessorKey: "itemType",
    header: "Type",
    cell: ({ row }) => {
      const type: ItemType = row.getValue("itemType");
      return (
        <Badge variant={type === ItemType.MANUFACTURED_GOOD ? "default" : "secondary"}>
          {formatItemType(type)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "inventoryCategory",
    header: "Category",
    cell: ({ row }) => {
      const item = row.original as InventoryItemRowData; // Use the specific type
      return item.inventoryCategory ? item.inventoryCategory.name : "N/A";
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

interface InventoryTableToolbarProps<TData> {
  table: ReactTableType<TData>;
  categoryOptions: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

function InventoryTableToolbar<TData>({ table, categoryOptions }: InventoryTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search SKU, name, description..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("inventoryCategory") && categoryOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("inventoryCategory")}
            title="Category"
            options={categoryOptions}
          />
        )}
      </div>
    </div>
  );
}

export function InventoryTable({ items, isLoading, rowSelection, setRowSelection, onDataChange, categoryOptions }: InventoryTableProps) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const table = useReactTable({
    data: items,
    columns, // Columns might need to be a function of categoryOptions if they use them directly for filtering
    state: {
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // For client-side filtering
    getPaginationRowModel: getPaginationRowModel(), // If adding pagination controls
    getSortedRowModel: getSortedRowModel(), // If adding sorting controls
    getFacetedRowModel: getFacetedRowModel(), // For faceted filters
    getFacetedUniqueValues: getFacetedUniqueValues(), // For faceted filters
    meta: {
        onDataChange,
        // categoryOptions, // Pass categoryOptions to columns if needed via meta
    }
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
    <div className="space-y-4">
      <InventoryTableToolbar table={table} categoryOptions={categoryOptions} />
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
      {/* Add DataTablePagination component here if implementing pagination */}
    </div>
  );
} 