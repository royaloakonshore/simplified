import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { CreateInvoiceSchema, UpdateInvoiceSchema, invoiceFilterSchema, invoicePaginationSchema, createInvoiceFromOrderSchema } from "@/lib/schemas/invoice.schema";
import { InvoiceStatus, OrderStatus, Prisma, PrismaClient } from '@prisma/client'; // Import PrismaClient for transaction typing, OrderStatus
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
              inventoryItem: true, // Corrected from item to inventoryItem
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
      const { customerId, invoiceDate, dueDate, notes, items, orderId, vatReverseCharge } = input;
      const userId = ctx.session.user.id;

      // Calculate totals and VAT, considering discounts and reverse charge
      let subTotal = new Decimal(0); // Represents total before VAT
      let totalVatAmountValue = new Decimal(0); // Renamed to avoid conflict with Prisma model field

      const invoiceItemsData = items.map(item => {
        const unitPrice = new Decimal(item.unitPrice);
        const quantity = new Decimal(item.quantity);
        let lineTotal = unitPrice.times(quantity);

        // Apply discount, prioritizing percentage
        if (item.discountPercent != null && item.discountPercent > 0) {
          const discountMultiplier = new Decimal(1).minus(
            new Decimal(item.discountPercent).div(100)
          );
          lineTotal = lineTotal.times(discountMultiplier);
        } else if (item.discountAmount != null && item.discountAmount > 0) {
          const discount = new Decimal(item.discountAmount);
          lineTotal = lineTotal.sub(discount).greaterThan(0) ? lineTotal.sub(discount) : new Decimal(0);
        }
        
        subTotal = subTotal.plus(lineTotal);

        // Calculate VAT for this line item if not reverse charge
        if (!vatReverseCharge) {
          const itemVat = lineTotal.times(new Decimal(item.vatRatePercent).div(100));
          totalVatAmountValue = totalVatAmountValue.plus(itemVat);
        }

        return {
          itemId: item.itemId,
          description: item.description,
          quantity: new Decimal(item.quantity),
          unitPrice: new Decimal(item.unitPrice), // Store original unit price
          vatRatePercent: new Decimal(item.vatRatePercent),
          discountAmount: item.discountAmount != null ? new Decimal(item.discountAmount) : null,
          discountPercent: item.discountPercent != null ? new Decimal(item.discountPercent) : null,
        };
      });

      // If VAT reverse charge is active, total VAT is explicitly zero
      if (vatReverseCharge) {
        totalVatAmountValue = new Decimal(0);
      }

      const finalTotalAmount = subTotal.plus(totalVatAmountValue);

      // --- Sequential Invoice Number Logic --- 
      const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { createdAt: 'desc' }, 
        select: { invoiceNumber: true }
      });

      let nextInvoiceNumber = 'INV-00001';
      if (lastInvoice && lastInvoice.invoiceNumber) {
        try {
            let numericPart = parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10);
            if (isNaN(numericPart)) numericPart = 0;

            const newNumericPart = numericPart + 1;
            const prefixMatch = lastInvoice.invoiceNumber.match(/^([^0-9]*)/);
            const prefix = prefixMatch && prefixMatch[0] ? prefixMatch[0] : 'INV-';
            
            const lastNumericString = lastInvoice.invoiceNumber.replace(/^[^0-9]*/, '');
            const paddingLength = lastNumericString.length > 0 ? lastNumericString.length : 5;

            nextInvoiceNumber = prefix + newNumericPart.toString().padStart(paddingLength, '0');

        } catch (e) {
            console.error("Failed to parse last invoice number:", lastInvoice.invoiceNumber, e);
            nextInvoiceNumber = `INV-${Date.now()}`;
        }
      } 
      // --- End Sequential Invoice Number Logic --- 

      const newInvoice = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Simplified collision check and resolution for invoice number
        let N = 0;
        let tempInvoiceNumber = nextInvoiceNumber;
        while (await tx.invoice.findUnique({ where: { invoiceNumber: tempInvoiceNumber } })) {
          N++;
          const prefixMatch = nextInvoiceNumber.match(/^([^0-9]*)/);
          const baseNumber = nextInvoiceNumber.replace(/^[^0-9]*/, '').replace(/-Retry-\d+$/, '');
          const prefix = prefixMatch && prefixMatch[0] ? prefixMatch[0] : 'INV-';
          tempInvoiceNumber = `${prefix}${baseNumber}-Retry-${N}`;
          if (N > 5) { 
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate a unique invoice number after multiple retries.' });
          }
        }
        nextInvoiceNumber = tempInvoiceNumber;

        return tx.invoice.create({
          data: {
            invoiceNumber: nextInvoiceNumber,
            customerId,
            invoiceDate,
            dueDate,
            notes,
            orderId: orderId ?? undefined,
            status: InvoiceStatus.draft,
            totalAmount: finalTotalAmount, 
            totalVatAmount: totalVatAmountValue, 
            vatReverseCharge: vatReverseCharge, 
            userId: userId, 
            items: {
              create: invoiceItemsData.map((item) => ({
                inventoryItemId: item.itemId,
                description: item.description,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice),
                vatRatePercent: new Prisma.Decimal(item.vatRatePercent),
                discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : undefined,
                discountPercentage: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : undefined,
              })),
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

  createFromOrder: protectedProcedure
    .input(createInvoiceFromOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const { orderId, invoiceDate, dueDate: inputDueDate, notes, vatReverseCharge } = input;
      const userId = ctx.session.user.id;

      return prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            customer: true,
            items: { include: { inventoryItem: true } },
          },
        });

        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }

        if (!order.customer) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order customer is missing' });
        }

        // Refined Order Status Check: Only allow from SHIPPED orders
        if (order.status !== OrderStatus.shipped) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invoice can only be created for orders with status SHIPPED. Current status: ${order.status}`,
          });
        }
        
        // Enable Duplicate Invoice Check
        const existingInvoice = await tx.invoice.findFirst({
          where: { orderId: order.id, isCreditNote: false } // Ensure it's not a credit note for the same order
        });
        if (existingInvoice) {
          throw new TRPCError({ code: 'CONFLICT', message: `An invoice (${existingInvoice.invoiceNumber}) already exists for order ${order.orderNumber}.` });
        }

        let subTotal = new Prisma.Decimal(0);
        let totalVatAmountValue = new Prisma.Decimal(0);

        const invoiceItemsData = order.items.map(orderItem => {
          if (!orderItem.inventoryItem) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Inventory item details missing for order item ${orderItem.id}` });
          }
          const unitPrice = new Prisma.Decimal(orderItem.unitPrice);
          const quantity = new Prisma.Decimal(orderItem.quantity);
          let lineTotal = unitPrice.times(quantity);

          // Apply discount from order item if present
          if (orderItem.discountPercentage != null && orderItem.discountPercentage.gt(0)) {
            const discountMultiplier = new Prisma.Decimal(1).minus(orderItem.discountPercentage.div(100));
            lineTotal = lineTotal.times(discountMultiplier);
          } else if (orderItem.discountAmount != null && orderItem.discountAmount.gt(0)) {
            lineTotal = lineTotal.sub(orderItem.discountAmount).greaterThanOrEqualTo(0) ? lineTotal.sub(orderItem.discountAmount) : new Prisma.Decimal(0);
          }

          subTotal = subTotal.plus(lineTotal);
          
          // TODO: Implement date-aware VAT logic. Defaulting to 25.5% as per new general rate effective Sep 1, 2024.
          // System should check invoiceDate to apply 24% for invoices before Sep 1, 2024.
          // Also, source vatRatePercent from InventoryItem.defaultVatRatePercent once that field is added and populated.
          const vatRate = new Prisma.Decimal(25.5); 

          if (!vatReverseCharge) {
            const itemVat = lineTotal.times(vatRate.div(100));
            totalVatAmountValue = totalVatAmountValue.plus(itemVat);
          }

          return {
            inventoryItemId: orderItem.inventoryItemId,
            description: orderItem.inventoryItem.name, 
            quantity: orderItem.quantity, 
            unitPrice: orderItem.unitPrice, 
            vatRatePercent: vatRate, 
            discountAmount: orderItem.discountAmount, 
            discountPercent: orderItem.discountPercentage, 
          };
        });
        
        if (vatReverseCharge) {
          totalVatAmountValue = new Prisma.Decimal(0);
        }
        const finalTotalAmount = subTotal.plus(totalVatAmountValue);

        // Generate Invoice Number 
        // This logic could be extracted to a shared utility function for consistency
        const lastInvoice = await tx.invoice.findFirst({
          orderBy: { createdAt: 'desc' }, 
          select: { invoiceNumber: true }
        });
        let nextInvoiceNumber = 'INV-00001'; 
        if (lastInvoice && lastInvoice.invoiceNumber) {
          try {
            let numericPart = parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10);
            if (isNaN(numericPart)) numericPart = 0; 

            const newNumericPart = numericPart + 1;
            const prefixMatch = lastInvoice.invoiceNumber.match(/^([^0-9]*)/);
            const prefix = prefixMatch && prefixMatch[0] ? prefixMatch[0] : 'INV-';
            
            const lastNumericString = lastInvoice.invoiceNumber.replace(/^[^0-9]*/, '');
            const paddingLength = lastNumericString.length > 0 ? lastNumericString.length : 5;

            nextInvoiceNumber = prefix + newNumericPart.toString().padStart(paddingLength, '0');

          } catch (e) {
            console.error("Error generating next invoice number:", e);
            nextInvoiceNumber = `INV-${Date.now()}`;
          }
        }
        
        // Simplified collision check and resolution
        let N = 0;
        let tempInvoiceNumber = nextInvoiceNumber;
        while (await tx.invoice.findUnique({ where: { invoiceNumber: tempInvoiceNumber } })) {
          N++;
          const prefixMatch = nextInvoiceNumber.match(/^([^0-9]*)/);
          const baseNumber = nextInvoiceNumber.replace(/^[^0-9]*/, '').replace(/-Retry-\d+$/, ''); 
          const prefix = prefixMatch && prefixMatch[0] ? prefixMatch[0] : 'INV-';
          tempInvoiceNumber = `${prefix}${baseNumber}-Retry-${N}`;
          if (N > 5) { 
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate a unique invoice number after multiple retries.' });
          }
        }
        nextInvoiceNumber = tempInvoiceNumber;


        const finalInvoiceDate = invoiceDate ?? new Date();
        const finalDueDate = inputDueDate ?? new Date(new Date(finalInvoiceDate).setDate(finalInvoiceDate.getDate() + 14)); 

        const newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber: nextInvoiceNumber,
            customerId: order.customerId,
            invoiceDate: finalInvoiceDate,
            dueDate: finalDueDate,
            notes: notes ?? order.notes, 
            orderId: order.id,
            status: InvoiceStatus.draft, 
            totalAmount: finalTotalAmount,
            totalVatAmount: totalVatAmountValue,
            vatReverseCharge: vatReverseCharge,
            userId: userId,
            items: {
              create: invoiceItemsData,
            },
          },
        });

        // Update Order status to INVOICED
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.INVOICED },
        });

        return newInvoice;
      });
    }),

  // TODO: Add update, delete procedures
}); 