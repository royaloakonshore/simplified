'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { BillOfMaterialItemInput } from '@/lib/schemas/bom.schema';

// Simplified inventory item type for the table
export interface RawMaterialRow {
  id: string;
  name: string;
  sku?: string | null;
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
    // Initialize row selection based on initially selected items
    const initialSelection: RowSelectionState = {};
    selectedItems.forEach(item => {
      const rowIndex = allRawMaterials.findIndex(material => material.id === item.componentItemId);
      if (rowIndex !== -1) {
        initialSelection[rowIndex] = true;
      }
    });
    return initialSelection;
  });

  // Memoize columns to prevent re-creation on every render
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
        id: 'quantity',
        header: 'Quantity',
        cell: ({ row }) => {
          const isSelected = row.getIsSelected();
          const currentItem = selectedItems.find(item => item.componentItemId === row.original.id);
          
          if (!isSelected) {
            return null; // Only show quantity input if row is selected
          }

          return (
            <Input
              type="number"
              value={currentItem?.quantity || 1} // Default to 1 if selected and no quantity yet
              onChange={(e) => {
                const newQuantity = parseInt(e.target.value, 10) || 0;
                const updatedItems = selectedItems.map(item =>
                  item.componentItemId === row.original.id
                    ? { ...item, quantity: newQuantity }
                    : item
                );
                // If the item wasn't in selectedItems before (e.g. just selected), add it.
                // This case should ideally be handled by the effect below, but good for direct interaction.
                if (!updatedItems.find(item => item.componentItemId === row.original.id)) {
                    updatedItems.push({ componentItemId: row.original.id, quantity: newQuantity });
                }
                onSelectedItemsChange(updatedItems.filter(item => item.quantity > 0)); // Filter out items with 0 quantity on change
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
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  // Effect to update the parent form's selectedItems state when table row selection changes
  React.useEffect(() => {
    const newSelectedFormItems: BillOfMaterialItemInput[] = [];
    allRawMaterials.forEach((material, index) => {
      if (rowSelection[index]) { // Check if the row at this index is selected
        const existingItem = selectedItems.find(item => item.componentItemId === material.id);
        newSelectedFormItems.push({
          componentItemId: material.id,
          quantity: existingItem?.quantity || 1, // Default to 1 or keep existing quantity
        });
      }
    });

    // Check if the derived list of selected items differs from the parent's list
    // This comparison needs to be robust (e.g., consider order, length, and content)
    const sortedNew = [...newSelectedFormItems].sort((a, b) => a.componentItemId.localeCompare(b.componentItemId));
    const sortedOld = [...selectedItems].sort((a, b) => a.componentItemId.localeCompare(b.componentItemId));

    if (JSON.stringify(sortedNew) !== JSON.stringify(sortedOld)) {
      onSelectedItemsChange(newSelectedFormItems);
    }
  }, [rowSelection, allRawMaterials, selectedItems, onSelectedItemsChange]);


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
                No raw materials available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
} 