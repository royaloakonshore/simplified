"use client";

import * as React from "react";
import { type Order, OrderStatus, OrderType, type Customer } from "@prisma/client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, MoreHorizontal, Eye, Factory, FileText, Download } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

// Define the expected shape of the order prop passed to the table
export type OrderTableRowData = Pick<Order, 'id' | 'orderNumber' | 'status' | 'orderType' | 'createdAt' | 'deliveryDate' | 'totalAmount'> & {
  customer: Pick<Customer, 'id' | 'name'> | null;
  vatAmount?: number;
};

interface OrderTableProps {
  data: OrderTableRowData[];
  isLoading: boolean;
  onDataChange?: (data: OrderTableRowData[]) => void;
}

// Status badge variant mapping
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case OrderStatus.draft:
      return "secondary";
    case OrderStatus.confirmed:
    case OrderStatus.in_production:
      return "default";
    case OrderStatus.shipped:
    case OrderStatus.delivered:
      return "outline";
    case OrderStatus.cancelled:
      return "destructive";
    default:
      return "secondary";
  }
};

// Status display text mapping for better UX
const getStatusDisplayText = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.draft:
      return "DRAFT";
    case OrderStatus.confirmed:
      return "CONFIRMED";
    case OrderStatus.in_production:
      return "IN PROD.";
    case OrderStatus.shipped:
      return "SHIPPED";
    case OrderStatus.delivered:
      return "READY TO INVOICE";
    case OrderStatus.cancelled:
      return "CANCELLED";
    case OrderStatus.invoiced:
      return "INVOICED";
    default:
      return String(status).replace('_', ' ').toUpperCase();
  }
};

// Order type display mapping
const getOrderTypeDisplay = (orderType: OrderType): string => {
  switch (orderType) {
    case OrderType.quotation:
      return "Quotation";
    case OrderType.work_order:
      return "Work Order";
    default:
      return orderType;
  }
};

// Row Actions Component
interface OrderTableRowActionsProps {
  order: OrderTableRowData;
  onActionSuccess?: () => void;
}

const OrderTableRowActions: React.FC<OrderTableRowActionsProps> = ({ order, onActionSuccess }) => {
  const router = useRouter();
  const utils = api.useUtils();

  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (data) => {
      toast.success("Invoice created successfully!");
      router.push(`/invoices/${data.id}`);
      onActionSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const handleCreateInvoice = () => {
    // Navigate to invoice creation page with order prefilled
    router.push(`/invoices/add?orderId=${order.id}`);
  };

  const handleSendToWorkOrder = () => {
    toast.info("Work order conversion functionality will be implemented soon");
  };

  const handleExportPDF = () => {
    toast.info("PDF export functionality will be implemented soon");
  };

  const canSendToWorkOrder = order.orderType === OrderType.quotation;
  const canCreateInvoice = order.status === OrderStatus.shipped || order.status === OrderStatus.delivered || order.status === OrderStatus.confirmed;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)}>
          <Eye className="mr-2 h-4 w-4" />
          <span>View Order</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleCreateInvoice}
          disabled={!canCreateInvoice || createInvoiceMutation.isPending}
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>{createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}</span>
        </DropdownMenuItem>
        {canSendToWorkOrder && (
          <DropdownMenuItem onClick={handleSendToWorkOrder}>
            <Factory className="mr-2 h-4 w-4" />
            <span>Create Work Order</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportPDF}>
          <Download className="mr-2 h-4 w-4" />
          <span>Export PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Column definitions
export const columns: ColumnDef<OrderTableRowData>[] = [
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
    accessorKey: "orderNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Order #" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/orders/${row.original.id}`}
        className="hover:underline font-medium"
      >
        {row.getValue("orderNumber")}
      </Link>
    ),
  },
  {
    accessorKey: "orderType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {getOrderTypeDisplay(row.getValue("orderType"))}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "customer.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => row.original.customer?.name ?? '-',
    accessorFn: (row) => row.customer?.name || "",
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    accessorKey: "deliveryDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Delivery Date" />
    ),
    cell: ({ row }) => {
      const deliveryDate = row.getValue("deliveryDate") as Date | null;
      return deliveryDate ? formatDate(deliveryDate) : '-';
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={getStatusBadgeVariant(row.getValue("status"))}>
        {getStatusDisplayText(row.getValue("status") as OrderStatus)}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" className="text-right" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatCurrency(row.getValue("totalAmount") ?? 0)}
      </div>
    ),
  },
  {
    accessorKey: "vatAmount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="VAT Amount" className="text-right" />
    ),
    cell: ({ row }) => {
      const vatAmount = row.original.vatAmount ?? (Number(row.original.totalAmount || 0) * 0.255);
      return <div className="text-right">{formatCurrency(vatAmount)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <OrderTableRowActions order={row.original} />,
  },
];

// Table Toolbar Component
interface OrderTableToolbarProps {
  table: ReturnType<typeof useReactTable<OrderTableRowData>>;
}

function OrderTableToolbar({ table }: OrderTableToolbarProps) {
  const statusOptions = Object.values(OrderStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
  }));

  const orderTypeOptions = Object.values(OrderType).map(type => ({
    value: type,
    label: getOrderTypeDisplay(type),
  }));

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search orders..."
          value={(table.getColumn("orderNumber")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("orderNumber")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
          />
        )}
        {table.getColumn("orderType") && (
          <DataTableFacetedFilter
            column={table.getColumn("orderType")}
            title="Type"
            options={orderTypeOptions}
          />
        )}
      </div>
    </div>
  );
}

// Main OrderTable Component
export default function OrderTable({ data, isLoading, onDataChange }: OrderTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableRowSelection: true,
    // Add meta for data change callback if needed
    meta: {
      onDataChange,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  if (isLoading && !data.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((_, i) => (
                  <TableHead key={i}>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
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
      <OrderTableToolbar table={table} />
      
      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedRows.length} order{selectedRows.length > 1 ? 's' : ''} selected
          </span>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export PDF ({selectedRows.length})
          </Button>
          <Button variant="outline" size="sm">
            Bulk Actions
          </Button>
        </div>
      )}

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
                  No orders found.
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