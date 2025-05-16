import { Skeleton } from "@/components/ui/skeleton";

export function CustomerTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Skeleton for DataTableToolbar */}
      <div className="flex items-center justify-between py-4">
        <Skeleton className="h-10 w-1/2 md:w-1/3" /> {/* Input filter */}
        <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-24" /> {/* Faceted filter placeholder */}
            <Skeleton className="h-10 w-20" /> {/* View options button */}
        </div>
      </div>

      {/* Skeleton for Table */}
      <div className="rounded-md border">
        <div className="w-full">
          {/* Table Header Skeleton */}
          <div className="border-b">
            <div className="flex h-12 items-center px-4">
              <Skeleton className="h-6 w-1/4 mr-4" />
              <Skeleton className="h-6 w-1/4 mr-4" />
              <Skeleton className="h-6 w-1/4 mr-4" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          </div>
          {/* Table Body Skeleton */}
          <div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex h-12 items-center border-b px-4">
                <Skeleton className="h-4 w-1/4 mr-4" />
                <Skeleton className="h-4 w-1/4 mr-4" />
                <Skeleton className="h-4 w-1/4 mr-4" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton for DataTablePagination */}
      <div className="flex items-center justify-between py-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
} 