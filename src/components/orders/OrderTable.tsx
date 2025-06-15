"use client";

import { type Order, OrderStatus, OrderType, type Customer, Prisma } from "@prisma/client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dropdown-menu";
import { ArrowRight, MoreHorizontal, Eye, Factory } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";

// Define the expected shape of the order prop passed to the table
// Matches the include statement in the list procedure
type OrderInTable = Order & {
  customer: Pick<Customer, 'id' | 'name'> | null;
  // items: { id: string }[]; // items are not included in the list query anymore
};

interface OrderTableProps {
  orders: OrderInTable[];
  nextCursor: string | undefined | null;
  // Props for selection
  selectedOrderIds: string[];
  onSelectOrder: (orderId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  isAllSelected: boolean;
}

// Helper function to format currency
const formatCurrency = (amount: number | string | Prisma.Decimal) => {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
};

// Helper function to format date
const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('fi-FI', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
};

// Helper function to get order type display text
const getOrderTypeDisplay = (orderType: OrderType): string => {
  switch (orderType) {
    case OrderType.work_order:
      return "Work Order";
    case OrderType.quotation:
      return "Quotation";
    default:
      return orderType;
  }
};

// Status badge variant mapping (similar to OrderDetail)
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

// OrderTableRowActions component for dropdown menu
const OrderTableRowActions = ({ order, onActionSuccess }: { order: OrderInTable, onActionSuccess: () => void }) => {
  const router = useRouter();
  const utils = api.useUtils();

  const convertToWorkOrderMutation = api.order.convertToWorkOrder.useMutation({
    onSuccess: (newWorkOrder) => {
      toast.success(`Work Order ${newWorkOrder.orderNumber} created successfully!`);
      onActionSuccess(); // Refresh the list
    },
    onError: (err) => {
      toast.error(`Failed to create Work Order: ${err.message}`);
    },
  });

  const handleSendToWorkOrder = () => {
    convertToWorkOrderMutation.mutate({ orderId: order.id });
  };

  const canSendToWorkOrder = order.orderType === OrderType.quotation && 
    (order.status === OrderStatus.confirmed || order.status === OrderStatus.draft);

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
        {canSendToWorkOrder && (
          <DropdownMenuItem 
            onClick={handleSendToWorkOrder}
            disabled={convertToWorkOrderMutation.isPending}
          >
            <Factory className="mr-2 h-4 w-4" />
            <span>{convertToWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function OrderTable({ 
  orders, 
  nextCursor, 
  selectedOrderIds,
  onSelectOrder,
  onSelectAll,
  isAllSelected
}: OrderTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const handleActionSuccess = () => {
    utils.order.list.invalidate();
  };

  const handleNextPage = () => {
    if (nextCursor) {
      const params = new URLSearchParams(searchParams);
      params.set('cursor', nextCursor);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // TODO: Implement handlePreviousPage if needed

  return (
    <div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  aria-label="Select all rows"
                />
              </TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow 
                  key={order.id}
                  data-state={selectedOrderIds.includes(order.id) ? "selected" : ""}
                >
                  <TableCell>
                    <Checkbox 
                      checked={selectedOrderIds.includes(order.id)}
                      onCheckedChange={(checked) => onSelectOrder(order.id, Boolean(checked))}
                      aria-label={`Select order ${order.orderNumber}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                     <Link href={`/orders/${order.id}`} className="hover:underline">
                       {order.orderNumber}
                     </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getOrderTypeDisplay(order.orderType)}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.customer?.name ?? '-'}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                     <Badge variant={getStatusBadgeVariant(order.status)}>
                        {order.status.replace('_', ' ').toUpperCase()}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.totalAmount ?? 0)}</TableCell>
                   <TableCell className="text-right">
                     <OrderTableRowActions order={order} onActionSuccess={handleActionSuccess} />
                   </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination Controls */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          {selectedOrderIds.length} of {orders.length} row(s) selected.
        </div>
        <div className="space-x-2">
          {/* TODO: Add Previous button if implementing bi-directional cursors */}
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => handlePreviousPage()}
            disabled={!previousCursor} // Need previousCursor prop
          >
             <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button> */} 
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNextPage()}
            disabled={!nextCursor}
          >
            Next Page <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 