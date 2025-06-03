'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { BillOfMaterialItemInput } from '@/lib/schemas/bom.schema';
import { Badge } from "@/components/ui/badge";

// Updated raw material type for the table
export interface RawMaterialRow {
  id: string;
  name: string;
  sku?: string | null;
  categoryName?: string | null;
  unitOfMeasure?: string | null;
  variant?: string | null;
}

// Props for the table
interface RawMaterialSelectionTableProps {
  allRawMaterials: RawMaterialRow[];
  selectedItems: BillOfMaterialItemInput[];
  onSelectedItemsChange: (items: BillOfMaterialItemInput[]) => void;
}

export function RawMaterialSelectionTable({
  allRawMaterials,
  selectedItems,
  onSelectedItemsChange,
}: RawMaterialSelectionTableProps) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(() => {
    const initialSelection: RowSelectionState = {};
    selectedItems.forEach(item => {
      const rowIndex = allRawMaterials.findIndex(material => material.id === item.componentItemId);
      if (rowIndex !== -1) {
        initialSelection[rowIndex] = true;
      }
    });
    return initialSelection;
  });
  const [globalFilter, setGlobalFilter] = React.useState('');

  const columns = React.useMemo<ColumnDef<RawMaterialRow, any>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
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
        header: 'SKU',
        cell: ({ row }) => row.original.sku || 'N/A',
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'categoryName',
        header: 'Category',
        cell: ({ row }) => row.original.categoryName || 'N/A',
      },
      {
        accessorKey: 'variant',
        header: 'Variant',
        cell: ({ row }) => {
          const variant = row.original.variant;
          return variant ? <Badge variant="outline">{variant}</Badge> : 'N/A';
        },
      },
      {
        accessorKey: 'unitOfMeasure',
        header: 'UoM',
        cell: ({ row }) => row.original.unitOfMeasure || 'N/A',
      },
      {
        id: 'quantity',
        header: 'Quantity',
        cell: ({ row }) => {
          const isSelected = row.getIsSelected();
          const currentItem = selectedItems.find(item => item.componentItemId === row.original.id);
          
          if (!isSelected) {
            return null;
          }

          return (
            <Input
              type="number"
              value={currentItem?.quantity || 1}
              onChange={(e) => {
                const newQuantity = parseInt(e.target.value, 10) || 0;
                const updatedItems = selectedItems.map(item =>
                  item.componentItemId === row.original.id
                    ? { ...item, quantity: newQuantity }
                    : item
                );
                if (!updatedItems.find(item => item.componentItemId === row.original.id)) {
                    updatedItems.push({ componentItemId: row.original.id, quantity: newQuantity });
                }
                onSelectedItemsChange(updatedItems.filter(item => item.quantity > 0));
              }}
              className="w-20"
              min="1"
            />
          );
        },
      },
    ],
    [selectedItems, onSelectedItemsChange]
  );

  const table = useReactTable({
    data: allRawMaterials,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  React.useEffect(() => {
    const newSelectedFormItems: BillOfMaterialItemInput[] = [];
    allRawMaterials.forEach((material) => {
      const originalRow = table.getCoreRowModel().rowsById[material.id];
      if (originalRow && originalRow.getIsSelected()) {
        const existingItem = selectedItems.find(item => item.componentItemId === material.id);
        newSelectedFormItems.push({
          componentItemId: material.id,
          quantity: existingItem?.quantity || 1,
        });
      }
    });

    const sortedNew = [...newSelectedFormItems].sort((a, b) => a.componentItemId.localeCompare(b.componentItemId));
    const sortedOld = [...selectedItems].sort((a, b) => a.componentItemId.localeCompare(b.componentItemId));

    if (JSON.stringify(sortedNew) !== JSON.stringify(sortedOld)) {
      onSelectedItemsChange(newSelectedFormItems);
    }
  }, [rowSelection, allRawMaterials, selectedItems, onSelectedItemsChange, table]);

  return (
    <div className="space-y-4">
        <Input
            placeholder="Search raw materials (SKU, Name)..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
        />
        <div className="rounded-md border">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                    {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                    data-state={row.getIsSelected() && 'selected'}
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
                    No raw materials match your search or none available.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        </div>
    </div>
  );
} 