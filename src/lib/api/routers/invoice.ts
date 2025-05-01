import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { CreateInvoiceSchema, UpdateInvoiceSchema, invoiceFilterSchema, invoicePaginationSchema } from "@/lib/schemas/invoice.schema";
import { InvoiceStatus, Prisma, PrismaClient } from '@prisma/client'; // Import PrismaClient for transaction typing
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal
import { prisma } from "@/lib/db"; // Import prisma client directly

// Type alias for Prisma Transaction Client
type PrismaTransactionClient = Omit<PrismaClient, '\$connect' | '\$disconnect' | '\$on' | '\$transaction' | '\$use' | '\$extends'>;


// Helper function to determine sorting order for list procedure
const getOrderBy = (
  sortBy: string | undefined,
  sortDirection: 'asc' | 'desc' | undefined
): Prisma.InvoiceOrderByWithRelationInput => {
  const direction = sortDirection ?? 'desc';
  switch (sortBy) {
    case 'invoiceNumber':
      return { invoiceNumber: direction };
    case 'invoiceDate':
      return { invoiceDate: direction };
    case 'dueDate':
      return { dueDate: direction };
    case 'totalAmount':
      return { totalAmount: direction };
    case 'status':
      return { status: direction };
    case 'customerName': // Requires relation sorting
      return { customer: { name: direction } };
    default:
      return { invoiceDate: direction }; // Fallback default sort
  }
};

export const invoiceRouter = createTRPCRouter({
  // Procedure to list invoices with pagination and filtering
  list: protectedProcedure
    .input(
      z.object({
        pagination: invoicePaginationSchema,
        filters: invoiceFilterSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, perPage, sortBy, sortDirection } = input.pagination;
      const { searchTerm, status } = input.filters;
      const skip = (page - 1) * perPage;
      const orderBy = getOrderBy(sortBy, sortDirection);

      // Construct where clause
      const whereClause: Prisma.InvoiceWhereInput = {
        // TODO: Add companyId filter when multi-tenancy is implemented
        // companyId: ctx.companyId,
        status: status ?? undefined,
        ...(searchTerm && {
          OR: [
            { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
            { customer: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { notes: { contains: searchTerm, mode: 'insensitive' } },
          ],
        }),
      };

      const [invoices, totalCount] = await prisma.$transaction([
        prisma.invoice.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: perPage,
          include: {
            customer: { select: { id: true, name: true } }, // Include customer name
            items: { select: { id: true } }, // Just count items for performance
          },
        }),
        prisma.invoice.count({ where: whereClause }),
      ]);

      return {
        data: invoices.map(inv => ({ ...inv, itemCount: inv.items.length })),
        meta: {
          totalCount,
          page,
          perPage,
          totalPages: Math.ceil(totalCount / perPage),
        },
      };
    }),

  // Procedure to get a single invoice by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: input.id,
          // TODO: Add companyId filter: companyId: ctx.companyId,
        },
        include: {
          customer: true,
          items: {
            include: {
              item: true, // Include InventoryItem details
            },
          },
          order: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        });
      }
      return invoice;
    }),
    
  // Procedure to create a new invoice
  create: protectedProcedure
    .input(CreateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { customerId, invoiceDate, dueDate, notes, items, orderId } = input;
      const userId = ctx.session.user.id; // Keep userId for potential logging/auditing
      // Removed: const prisma = ctx.db; 

      // TODO: Later, replace userId checks/scoping with companyId when multi-tenancy is fully implemented
      // For now, we assume invoices are scoped globally or implicitly by user association.

      // Calculate totals and VAT
      let totalAmount = new Decimal(0);
      let totalVatAmount = new Decimal(0);

      const invoiceItemsData = items.map(item => {
        const itemTotal = new Decimal(item.quantity).times(item.unitPrice);
        const itemVat = itemTotal.times(new Decimal(item.vatRatePercent).div(100));
        totalAmount = totalAmount.plus(itemTotal);
        totalVatAmount = totalVatAmount.plus(itemVat);
        return {
          itemId: item.itemId,
          description: item.description, // Optional description override
          quantity: new Decimal(item.quantity),
          unitPrice: new Decimal(item.unitPrice),
          vatRatePercent: new Decimal(item.vatRatePercent),
        };
      });

      // --- Sequential Invoice Number Logic --- 
      // Find the highest invoice number (globally for now)
      // WARNING: Still not atomic without proper db sequences/locks
      const lastInvoice = await prisma.invoice.findFirst({
        // where: { companyId: ctx.companyId }, // Use when companyId is available
        orderBy: { invoiceNumber: 'desc' }, 
        select: { invoiceNumber: true }
      });

      let nextInvoiceNumber = '1'; // Default for the first invoice
      if (lastInvoice && lastInvoice.invoiceNumber) {
        try {
            // Attempt to increment the numeric part
            nextInvoiceNumber = (parseInt(lastInvoice.invoiceNumber, 10) + 1).toString();
        } catch (e) {
            console.error("Failed to parse last invoice number:", lastInvoice.invoiceNumber, e);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Could not determine the next invoice number.'
            });
        }
      }
      // --- End Sequential Invoice Number Logic --- 

      // Use a transaction to ensure atomicity
      const newInvoice = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Double check number hasn't been taken (mitigation for race condition)
        const existing = await tx.invoice.findUnique({
          where: { invoiceNumber: nextInvoiceNumber },
          select: { id: true }
        });
        if (existing) {
           throw new TRPCError({
              code: 'CONFLICT', 
              message: `Invoice number ${nextInvoiceNumber} already exists. Please try again.`
           });
        }

        return tx.invoice.create({
          data: {
            invoiceNumber: nextInvoiceNumber,
            customerId,
            invoiceDate,
            dueDate,
            notes,
            orderId: orderId ?? undefined,
            status: InvoiceStatus.draft,
            totalAmount,
            totalVatAmount,
            // userId: userId, // Link to user if needed
            // companyId: ctx.companyId // Add when available
            items: {
              createMany: {
                data: invoiceItemsData,
              },
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });
      });

      return newInvoice;
    }),

  // TODO: Add update, delete procedures
}); 