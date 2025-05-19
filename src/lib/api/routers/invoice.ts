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
        orderBy: { invoiceNumber: 'desc' }, 
        select: { invoiceNumber: true }
      });

      let nextInvoiceNumber = '1';
      if (lastInvoice && lastInvoice.invoiceNumber) {
        try {
            nextInvoiceNumber = (parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10) + 1).toString();
            // Attempt to preserve prefix if any (e.g., INV-)
            const prefixMatch = lastInvoice.invoiceNumber.match(/^([^0-9]*)/);
            if (prefixMatch && prefixMatch[0]) {
              nextInvoiceNumber = prefixMatch[0] + nextInvoiceNumber;
            } else {
              // Fallback: Pad with leading zeros if no clear prefix (e.g. 00001)
               nextInvoiceNumber = nextInvoiceNumber.padStart(5, '0');
            }

        } catch (e) {
            console.error("Failed to parse last invoice number:", lastInvoice.invoiceNumber, e);
            // Fallback to simpler increment if parsing fails
            const numericPart = parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10);
            if (!isNaN(numericPart)) {
              nextInvoiceNumber = (numericPart + 1).toString().padStart(5, '0');
            } else {
               // Absolute fallback: use timestamp if all else fails to ensure uniqueness
              nextInvoiceNumber = `INV-${Date.now()}`;
            }
        }
      } else {
          // Default for first invoice, e.g., INV-00001 or 00001
          nextInvoiceNumber = 'INV-00001'; 
      }
      // --- End Sequential Invoice Number Logic --- 

      const newInvoice = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const existing = await tx.invoice.findUnique({
          where: { invoiceNumber: nextInvoiceNumber },
          select: { id: true }
        });
        if (existing) {
           // If number collision, try to generate a slightly modified one (e.g. by adding a suffix)
           // This is a simple mitigation; a robust solution needs DB sequences or better locking.
           const timestampSuffix = Date.now().toString().slice(-4);
           nextInvoiceNumber = `${nextInvoiceNumber}-${timestampSuffix}`;
           const retryExisting = await tx.invoice.findUnique({
               where: { invoiceNumber: nextInvoiceNumber },
               select: { id: true }
           });
           if (retryExisting) {
              throw new TRPCError({
                  code: 'CONFLICT', 
                  message: `Invoice number ${nextInvoiceNumber} already exists after retry. Please try again.`
              });
           }
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
            totalAmount: finalTotalAmount, // Use the final calculated total
            totalVatAmount: totalVatAmountValue, // Use the calculated VAT
            vatReverseCharge: vatReverseCharge, // Store the flag
            userId: userId, // Uncommented: userId can now be saved
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

        // Check if order status is appropriate (e.g., not draft or cancelled)
        if (order.status === OrderStatus.draft || order.status === OrderStatus.cancelled) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot create invoice for order with status: ${order.status}`,
          });
        }
        
        // TODO: Check if an invoice already exists for this order to prevent duplicates?
        // const existingInvoice = await tx.invoice.findFirst({
        //   where: { orderId: order.id }
        // });
        // if (existingInvoice) {
        //   throw new TRPCError({ code: 'CONFLICT', message: `Invoice already exists for order ${order.orderNumber}` });
        // }

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
          
          // Using a default VAT rate of 24% for now as InventoryItem does not have vatRate
          const vatRate = new Prisma.Decimal(24); // Default 24%

          if (!vatReverseCharge) {
            const itemVat = lineTotal.times(vatRate.div(100));
            totalVatAmountValue = totalVatAmountValue.plus(itemVat);
          }

          return {
            inventoryItemId: orderItem.inventoryItemId,
            description: orderItem.inventoryItem.name, // Or a more detailed description from orderItem if available
            quantity: orderItem.quantity, // Already Decimal
            unitPrice: orderItem.unitPrice, // Already Decimal
            vatRatePercent: vatRate, // Use determined VAT rate (defaulted to 24%)
            discountAmount: orderItem.discountAmount, // Already Decimal or null
            discountPercent: orderItem.discountPercentage, // Corrected to discountPercentage
          };
        });
        
        if (vatReverseCharge) {
          totalVatAmountValue = new Prisma.Decimal(0);
        }
        const finalTotalAmount = subTotal.plus(totalVatAmountValue);

        // Generate Invoice Number (reusing logic from `create` or a shared helper)
        const lastInvoice = await tx.invoice.findFirst({
          orderBy: { invoiceNumber: 'desc' }, 
          select: { invoiceNumber: true }
        });
        let nextInvoiceNumber = 'INV-00001'; 
        if (lastInvoice && lastInvoice.invoiceNumber) {
          try {
            nextInvoiceNumber = (parseInt(lastInvoice.invoiceNumber.replace(/\D/g, ''), 10) + 1).toString();
            const prefixMatch = lastInvoice.invoiceNumber.match(/^([^0-9]*)/);
            if (prefixMatch && prefixMatch[0]) {
              nextInvoiceNumber = prefixMatch[0] + nextInvoiceNumber.padStart(5, '0');
            } else {
              nextInvoiceNumber = nextInvoiceNumber.padStart(5, '0');
            }
          } catch (e) {
            nextInvoiceNumber = `INV-${Date.now()}`;
          }
        }
        // Check for collision (simplified)
        const existingNum = await tx.invoice.findUnique({ where: { invoiceNumber: nextInvoiceNumber } });
        if (existingNum) {
          nextInvoiceNumber = `${nextInvoiceNumber}-${Date.now().toString().slice(-3)}`;
        }

        const finalInvoiceDate = invoiceDate ?? new Date();
        const finalDueDate = inputDueDate ?? new Date(new Date(finalInvoiceDate).setDate(finalInvoiceDate.getDate() + 14)); // Default due date: 14 days from invoice date

        const newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber: nextInvoiceNumber,
            customerId: order.customerId,
            invoiceDate: finalInvoiceDate,
            dueDate: finalDueDate,
            notes: notes ?? order.notes, // Default to order notes if invoice notes not provided
            orderId: order.id,
            status: InvoiceStatus.draft, // Default status
            totalAmount: finalTotalAmount,
            totalVatAmount: totalVatAmountValue,
            vatReverseCharge: vatReverseCharge,
            userId: userId, // Uncommented: userId can now be saved
            items: {
              create: invoiceItemsData,
            },
          },
        });
        return newInvoice;
      });
    }),

  // TODO: Add update, delete procedures
}); 