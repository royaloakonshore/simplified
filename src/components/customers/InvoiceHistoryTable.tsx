"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type RouterOutputs } from "@/lib/api/root";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Invoice = RouterOutputs["invoice"]["list"]["data"][number];

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
}

export function InvoiceHistoryTable({ invoices }: InvoiceHistoryTableProps) {
  if (invoices.length === 0) {
    return <p>No invoices found for this customer.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link
                href={`/invoices/${invoice.id}`}
                className="text-primary hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
            </TableCell>
            <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
            <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
            <TableCell>
              <Badge>{invoice.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.totalAmount.toNumber())}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 