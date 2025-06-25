'use client';

import React from 'react';
import { 
    ColumnDef, 
    flexRender, 
    getCoreRowModel, 
    useReactTable, 
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
} from "@tanstack/react-table";
import { ItemType } from '@prisma/client';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination"; 
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

// Type for price list items (subset of inventory items)
export type PriceListItemRowData = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  itemType: ItemType;
  salesPrice: string;
  inventoryCategory: { id: string; name: string } | null;
  variant: string | null;
  showInPricelist: boolean;
  createdAt: Date;
  updatedAt: Date;
};

interface PriceListTableProps {
  data: PriceListItemRowData[];
  isLoading: boolean;
  categoryOptions: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

const formatItemType = (type: ItemType) => {
  switch (type) {
    case ItemType.RAW_MATERIAL:
      return "Raw Material";
    case ItemType.MANUFACTURED_GOOD:
      return "Manufactured";
    default:
      return type;
  }
};

interface PriceListTableToolbarProps<TData> {
  table: any;
  categoryOptions: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}

function PriceListTableToolbar<TData>({ table, categoryOptions }: PriceListTableToolbarProps<TData>) {
  const itemTypeOptions = [
    {
      value: ItemType.RAW_MATERIAL,
      label: "Raw Material",
    },
    {
      value: ItemType.MANUFACTURED_GOOD,
      label: "Manufactured",
    },
  ];

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
        {table.getColumn("itemType") && (
          <DataTableFacetedFilter
            column={table.getColumn("itemType")}
            title="Type"
            options={itemTypeOptions}
          />
        )}
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

export default function PriceListTable({ data, isLoading, categoryOptions }: PriceListTableProps) {
  const columns = React.useMemo<ColumnDef<PriceListItemRowData>[]>(() => [
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
      accessorKey: 'sku',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => (
        <div className="font-mono">{row.getValue("sku") || 'N/A'}</div>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'itemType',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const itemType = row.getValue("itemType") as ItemType;
        return (
          <Badge variant={itemType === ItemType.MANUFACTURED_GOOD ? "default" : "secondary"}>
            {formatItemType(itemType)}
          </Badge>
        );
      },
      enableSorting: true,
      enableHiding: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'inventoryCategory',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const category = row.original.inventoryCategory;
        return category ? (
          <Badge variant="outline">{category.name}</Badge>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      },
      enableSorting: false,
      enableHiding: true,
      filterFn: (row, id, value) => {
        const category = row.original.inventoryCategory;
        return value.includes(category?.id || '');
      },
    },
    {
      accessorKey: 'variant',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Variant" />
      ),
      cell: ({ row }) => (
        <div>{row.getValue("variant") || 'N/A'}</div>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: 'salesPrice',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Sales Price" className="text-right" />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("salesPrice") || "0");
        return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
      },
      enableSorting: true,
      enableHiding: true,
    },
  ], []);
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data, 
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-8 w-[250px]" />
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(6)].map((_, i) => (
                  <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PriceListTableToolbar table={table} categoryOptions={categoryOptions} />
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
                  No items available for price list.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
} 