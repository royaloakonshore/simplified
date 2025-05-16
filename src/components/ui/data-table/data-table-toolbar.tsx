"use client"

import { type Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { DataTableViewOptions } from "./data-table-view-options"
// Import DataTableFacetedFilter if you plan to use it directly here
// import { DataTableFacetedFilter } from "./data-table-faceted-filter"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  globalFilter?: string // Optional: if global filter is managed outside
  setGlobalFilter?: (value: string) => void // Optional: if global filter is managed outside
  // You can add more props for specific faceted filters if needed
  // e.g. statusOptions for a status filter
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || (globalFilter && globalFilter.length > 0)

  // Determine if global filter is managed internally or externally
  const currentGlobalFilter = globalFilter ?? (table.getState().globalFilter as string) ?? ""
  const onGlobalFilterChange = setGlobalFilter ?? ((value) => table.setGlobalFilter(value))


  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter all columns..."
          value={currentGlobalFilter}
          onChange={(event) => onGlobalFilterChange(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {/* Example of how to integrate DataTableFacetedFilter if needed */} 
        {/* {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions} // statusOptions would be defined and passed in
          />
        )} */} 
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              if (setGlobalFilter) setGlobalFilter(""); else table.setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
} 