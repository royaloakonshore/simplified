'use client';

import * as React from "react";
import { type Customer } from "@prisma/client"; // Assuming Prisma types are directly usable
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CustomerTableProps {
  customers: Customer[];
  isLoading: boolean;
  // TODO: Add pagination props (hasNextPage, fetchNextPage, etc.)
}

export function CustomerTable({ customers, isLoading }: CustomerTableProps) {
  if (isLoading) {
    // TODO: Replace with Shadcn Skeleton Loader
    return <div>Loading...</div>;
  }

  if (!customers || customers.length === 0) {
    return <div>No customers found.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>VAT ID</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell className="font-medium">{customer.name}</TableCell>
            <TableCell>{customer.email ?? "-"}</TableCell>
            <TableCell>{customer.phone ?? "-"}</TableCell>
            <TableCell>{customer.vatId ?? "-"}</TableCell>
            <TableCell>
              <Link href={`/customers/${customer.id}/edit`} passHref>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
              {/* Add Delete button later */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    // TODO: Add pagination controls (Next/Previous buttons)
  );
} 