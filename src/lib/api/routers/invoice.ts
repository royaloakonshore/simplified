import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createTRPCRouter, protectedProcedure } from '@/lib/api/trpc';
import { invoiceFilterSchema, invoicePaginationSchema } from '@/lib/schemas/invoice.schema';
import { prisma } from '@/lib/db';

// Define the type for sorting columns - adjust based on actual sortable Invoice fields
type InvoiceSortableColumns = 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'totalAmount' | 'status' | 'customer.name';

const getOrderBy = (sortBy: string | undefined, sortDirection: 'asc' | 'desc' | undefined): Prisma.InvoiceOrderByWithRelationInput => {
  const safeSortBy = sortBy as InvoiceSortableColumns | undefined;
  const direction = sortDirection ?? 'desc';

  if (!safeSortBy) {
    return { invoiceDate: direction }; // Default sort
  }

  // Handle nested sorting for customer name
  if (safeSortBy === 'customer.name') {
    return { customer: { name: direction } };
  }

  // Standard sorting for direct fields
  if (['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status'].includes(safeSortBy)) {
    return { [safeSortBy]: direction };
  }

  return { invoiceDate: direction }; // Fallback default sort
};

export const invoiceRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        filters: invoiceFilterSchema.optional(),
        pagination: invoicePaginationSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { filters = {}, pagination } = input;
      const { page = 1, perPage = 10, sortBy, sortDirection } = pagination ?? {};
      const { customerId, status, fromDate, toDate, searchTerm } = filters;

      const skip = (page - 1) * perPage;
      const take = perPage;

      const where: Prisma.InvoiceWhereInput = {
        // Apply filters
        customerId: customerId ? { equals: customerId } : undefined,
        status: status ? { equals: status } : undefined,
        invoiceDate: {
          gte: fromDate ? new Date(fromDate) : undefined,
          lte: toDate ? new Date(toDate) : undefined,
        },
        // Apply search term across relevant fields
        ...(searchTerm && {
          OR: [
            { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
            { notes: { contains: searchTerm, mode: 'insensitive' } },
            { customer: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { order: { orderNumber: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        }),
      };

      const orderBy = getOrderBy(sortBy, sortDirection);

      const [invoices, totalInvoices] = await prisma.$transaction([
        prisma.invoice.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            customer: true, // Include customer details for display
            order: { // Include order number if linked
              select: { orderNumber: true }
            }
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalPages = Math.ceil(totalInvoices / perPage);

      return {
        invoices,
        pagination: {
          currentPage: page,
          perPage,
          totalItems: totalInvoices,
          totalPages,
        },
      };
    }),

  // TODO: Add procedures for get, create, update, delete, etc.
}); 