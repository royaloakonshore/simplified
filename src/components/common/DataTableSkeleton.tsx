import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface DataTableSkeletonProps {
  columnCount: number;
  rowCount?: number;
  cellWidths?: string[];
  showHeader?: boolean;
  showToolbar?: boolean;
  showPagination?: boolean;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  cellWidths = [],
  showHeader = true,
  showToolbar = false,
  showPagination = true,
}: DataTableSkeletonProps) {
  return (
    <div className="space-y-4">
      {showToolbar && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[250px]" /> {/* Search input */}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[120px]" /> {/* Dropdown button */}
            <Skeleton className="h-9 w-9" /> {/* View options */}
          </div>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          {showHeader && (
            <TableHeader>
              <TableRow>
                {Array.from({ length: columnCount }).map((_, i) => (
                  <TableHead key={i} style={{ width: cellWidths[i] }}>
                    <Skeleton className="h-5 w-full" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell key={j} style={{ width: cellWidths[j] }}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-8 w-[200px]" /> {/* Rows selected/page size */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-[100px]" /> {/* Page indicator */}
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-8" /> {/* Previous button */}
              <Skeleton className="h-8 w-8" /> {/* Next button */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 