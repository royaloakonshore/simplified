'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type RouterOutputs } from "@/lib/api/root";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Order = RouterOutputs["order"]["list"]["items"][number];

interface OrderHistoryTableProps {
  orders: Order[];
}

export function OrderHistoryTable({ orders }: OrderHistoryTableProps) {
  if (orders.length === 0) {
    return <p>No orders found for this customer.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <Link
                href={`/orders/${order.id}`}
                className="text-blue-600 hover:underline"
                legacyBehavior>
                {order.orderNumber}
              </Link>
            </TableCell>
            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>
              <Badge>{order.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {order.totalAmount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.totalAmount.toNumber()) : 'N/A'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 