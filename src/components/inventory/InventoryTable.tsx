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
import EditableQuantityCell, { type CellItemData } from "./EditableQuantityCell";
import { api } from "@/lib/trpc/react";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";

// Define a more specific type for items in the table, matching what `itemsForTable` in inventory/page.tsx produces
export type InventoryItemRowData = Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'minimumStockLevel' | 'reorderLevel' | 'quantityOnHand' | 'defaultVatRatePercent'> & { 
  quantityOnHand: string; 
  costPrice: string; 
  salesPrice: string; 
  minimumStockLevel: string; 
  reorderLevel: string | null; 
  defaultVatRatePercent: string | null;
  inventoryCategory: { id: string; name: string } | null; 
};

interface InventoryTableProps {
  table: ReactTableType<InventoryItemRowData>;
  isLoading: boolean;
  onDataChange: (rowIndex: number, columnId: string, value: any) => void;
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
      // row.original should conform to InventoryItemRowData defined above
      const currentItem = row.original as InventoryItemRowData;
      const meta = table.options.meta as { 
        onDataChange?: (rowIndex: number, columnId: string, value: any) => void 
      };
      
      // Ensure itemForCell conforms to CellItemData for EditableQuantityCell
      // Given InventoryItemRowData and CellItemData are structurally very similar 
      // (both stringified versions of InventoryItem fields), direct assignment of compatible fields is best.
      const itemForCell: CellItemData = {
        // Fields from InventoryItem not overridden in CellItemData (via Omit)
        id: currentItem.id,
        createdAt: currentItem.createdAt,
        updatedAt: currentItem.updatedAt,
        sku: currentItem.sku,
        name: currentItem.name,
        description: currentItem.description,
        qrIdentifier: currentItem.qrIdentifier,
        unitOfMeasure: currentItem.unitOfMeasure,
        defaultVatRatePercent: currentItem.defaultVatRatePercent,
        showInPricelist: currentItem.showInPricelist,
        internalRemarks: currentItem.internalRemarks,
        supplierId: currentItem.supplierId,
        inventoryCategoryId: currentItem.inventoryCategoryId,
        itemType: currentItem.itemType,
        companyId: currentItem.companyId,
        leadTimeDays: currentItem.leadTimeDays,
        vendorSku: currentItem.vendorSku,
        vendorItemName: currentItem.vendorItemName,
        // Overridden fields in CellItemData (must be string or string | null)
        costPrice: currentItem.costPrice,
        salesPrice: currentItem.salesPrice,
        quantityOnHand: currentItem.quantityOnHand,
        minimumStockLevel: currentItem.minimumStockLevel,
        reorderLevel: currentItem.reorderLevel,
      };
      
      const handleCellUpdate = (itemId: string, newQuantity: number) => { 
        if (meta?.onDataChange) {
          meta.onDataChange(row.index, 'quantityOnHand', newQuantity);
        }
      };

      return <EditableQuantityCell item={itemForCell} onUpdate={handleCellUpdate} />;
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

export function InventoryTable({ table, isLoading, onDataChange, categoryOptions }: InventoryTableProps) {
  if (isLoading && !table.getRowModel().rows.length) {
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

  if (!table.getRowModel().rows.length) {
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