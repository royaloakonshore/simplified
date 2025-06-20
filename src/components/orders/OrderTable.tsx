"use client";

import { type Order, OrderStatus, type Customer, Prisma } from "@prisma/client";
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
import { ArrowRight, ArrowLeft } from "lucide-react";

// Define the expected shape of the order prop passed to the table
// Matches the include statement in the list procedure
type OrderInTable = Order & {
  customer: Pick<Customer, 'id' | 'name'> | null;
  // items: { id: string }[]; // items are not included in the list query anymore
};

interface OrderTableProps {
  orders: OrderInTable[];
  nextCursor: string | undefined | null;
  // Add previousCursor if implementing Prev button
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


export default function OrderTable({ orders, nextCursor }: OrderTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              {/* <TableHead>Items</TableHead> */}{/* Removed, as items are not fetched in list */}
              <TableHead className="text-right">Total</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                     <Link href={`/orders/${order.id}`} className="hover:underline">
                       {order.orderNumber}
                     </Link>
                  </TableCell>
                  <TableCell>{order.customer?.name ?? '-'}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                     <Badge variant={getStatusBadgeVariant(order.status)}>
                        {order.status.replace('_', ' ').toUpperCase()}
                     </Badge>
                  </TableCell>
                  {/* <TableCell>{order.items.length}</TableCell> */}
                  <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                   <TableCell className="text-right">
                     <Button variant="outline" size="sm" asChild>
                       <Link href={`/orders/${order.id}`}>View</Link>
                     </Button>
                   </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination Controls */}
      <div className="flex items-center justify-end space-x-2 py-4">
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
  );
} 