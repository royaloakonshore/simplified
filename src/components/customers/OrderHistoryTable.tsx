'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type RouterOutputs } from "@/lib/api/root";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getOrderStatusDisplayText, getOrderStatusBadgeVariant } from "@/lib/utils/status-display";

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
                className="text-primary hover:underline"
              >
                {order.orderNumber}
              </Link>
            </TableCell>
            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>
              <Badge variant={getOrderStatusBadgeVariant(order.status)}>
                {getOrderStatusDisplayText(order.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {order.totalAmount && typeof order.totalAmount === 'object' && order.totalAmount !== null && 'toNumber' in order.totalAmount ? 
                new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(order.totalAmount.toNumber()) : 
                'N/A'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 