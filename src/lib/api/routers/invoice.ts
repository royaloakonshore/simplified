import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, companyProtectedProcedure } from "@/lib/api/trpc";
import { CreateInvoiceSchema, UpdateInvoiceSchema, invoiceFilterSchema, invoicePaginationSchema, createInvoiceFromOrderSchema, type CreateInvoiceItemSchema, type UpdateInvoiceItemSchema } from "@/lib/schemas/invoice.schema";
import { CreatePartialCreditNoteSchema } from "@/lib/schemas/credit-note.schema";
import { Prisma, PrismaClient, InvoiceStatus, OrderStatus, type OrderItem, type InventoryItem, type ItemType, type Address, type InvoiceItem as PrismaInvoiceItem } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; 
import { prisma } from "@/lib/db"; 
import { generateFinvoiceXml, type SellerSettings } from "@/lib/services/finvoice.service"; 
import { createAppCaller } from "@/lib/api/root"; 
import { createDecimal } from '../../types/branded'; // Added import for createDecimal
import { generateInvoiceReferenceNumber } from '@/lib/utils/finnishReferenceNumber';
import { triggerInvoicePdfGeneration } from "@/lib/inngest/pdf-generation";

// Type alias for Prisma Transaction Client
type PrismaTransactionClient = Omit<PrismaClient, '\$connect' | '\$disconnect' | '\$on' | '\$transaction' | '\$use' | '\$extends'>;

// Helper function to generate a unique invoice number
async function generateInvoiceNumber(tx: PrismaTransactionClient): Promise<string> {
  const year = new Date().getFullYear().toString().substring(2);
  const invoiceCount = await tx.invoice.count({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`,
      },
    },
  });
  const sequenceNumber = (invoiceCount + 1).toString().padStart(5, '0');
  return `INV-${year}-${sequenceNumber}`;
}

type OrderItemWithInventory = Prisma.OrderItemGetPayload<{
  include: { inventoryItem: true }
}>;

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
    case 'customerName': 
    return { customer: { name: direction } };
    default:
  return { invoiceDate: direction }; 
  }
};

const listInvoicesInputSchema = invoicePaginationSchema.merge(invoiceFilterSchema);

export const invoiceRouter = createTRPCRouter({
  list: companyProtectedProcedure
    .input(listInvoicesInputSchema) 
    .query(async ({ ctx, input }) => {
      const { 
        page = 1, 
        perPage = 10, 
        sortBy, 
        sortDirection, 
        customerId, 
        status, 
        fromDate, 
        toDate, 
        searchTerm 
      } = input;

      const whereClause: Prisma.InvoiceWhereInput = {
        companyId: ctx.companyId,
      };

      if (customerId) whereClause.customerId = customerId as string;
      if (status) whereClause.status = status as InvoiceStatus;
      if (fromDate) whereClause.invoiceDate = typeof whereClause.invoiceDate === 'object' && whereClause.invoiceDate !== null && !Array.isArray(whereClause.invoiceDate) ? { ...whereClause.invoiceDate, gte: fromDate as Date } : { gte: fromDate as Date }; 
      if (toDate) whereClause.invoiceDate = typeof whereClause.invoiceDate === 'object' && whereClause.invoiceDate !== null && !Array.isArray(whereClause.invoiceDate) ? { ...whereClause.invoiceDate, lte: toDate as Date } : { lte: toDate as Date };     
      if (searchTerm) {
        whereClause.OR = [
          { invoiceNumber: { contains: searchTerm as string, mode: 'insensitive' } },
          { customer: { name: { contains: searchTerm as string, mode: 'insensitive' } } },
          { notes: { contains: searchTerm as string, mode: 'insensitive' } },
        ];
      }

      const orderBy = getOrderBy(sortBy as string | undefined, sortDirection as 'asc' | 'desc' | undefined);

      const numericPage = Number(page);
      const numericPerPage = Number(perPage);

      const [invoices, totalCount] = await prisma.$transaction([
        prisma.invoice.findMany({
          where: whereClause,
          orderBy,
          skip: (numericPage - 1) * numericPerPage, 
          take: numericPerPage,             
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            invoiceDate: true,
            dueDate: true,
            totalAmount: true,
            totalVatAmount: true,
            customerId: true,
            isReminder: true,
            penaltyInterest: true,
            customer: { select: { id: true, name: true } },
            items: { select: { id: true } },
          },
        }),
        prisma.invoice.count({ where: whereClause }),
      ]);

      return {
        data: invoices,
        meta: {
          totalCount,
          page: numericPage,
          perPage: numericPerPage, 
          totalPages: Math.ceil(totalCount / numericPerPage), 
        },
      };
    }),

  get: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: input.id,
          companyId: ctx.companyId,
        },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: true,
            },
          },
          order: {
            include: {
              customer: true,
              items: {
                include: {
                  inventoryItem: true
                }
              }
            }
          },
          payments: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        });
      }

      // Perform targeted Decimal to string conversions
      const transformInvoiceData = (inv: typeof invoice): any => {
        const transformed = { ...inv } as any;

        // Invoice level Decimals
        if (transformed.totalAmount instanceof Decimal) {
          transformed.totalAmount = transformed.totalAmount.toString();
        }
        if (transformed.totalVatAmount instanceof Decimal) {
          transformed.totalVatAmount = transformed.totalVatAmount.toString();
        }
        if (transformed.paidAmount instanceof Decimal) {
          transformed.paidAmount = transformed.paidAmount.toString();
        }
        if (transformed.creditedAmount instanceof Decimal) {
          transformed.creditedAmount = transformed.creditedAmount.toString();
        }

        // Invoice Items
        if (transformed.items && Array.isArray(transformed.items)) {
          transformed.items = transformed.items.map((item: any) => {
            const newItem = { ...item };
            if (newItem.quantity instanceof Decimal) newItem.quantity = newItem.quantity.toString();
            if (newItem.unitPrice instanceof Decimal) newItem.unitPrice = newItem.unitPrice.toString();
            if (newItem.vatRatePercent instanceof Decimal) newItem.vatRatePercent = newItem.vatRatePercent.toString();
            if (newItem.discountAmount instanceof Decimal) newItem.discountAmount = newItem.discountAmount.toString();
            if (newItem.discountPercentage instanceof Decimal) newItem.discountPercentage = newItem.discountPercentage.toString();
            if (newItem.calculatedUnitCost instanceof Decimal) newItem.calculatedUnitCost = newItem.calculatedUnitCost.toString();
            if (newItem.calculatedUnitProfit instanceof Decimal) newItem.calculatedUnitProfit = newItem.calculatedUnitProfit.toString();
            if (newItem.calculatedLineProfit instanceof Decimal) newItem.calculatedLineProfit = newItem.calculatedLineProfit.toString();
            
            // Decimal fields on nested inventoryItem within invoice item
            if (newItem.inventoryItem) {
                const invItem = { ...newItem.inventoryItem };
                if (invItem.costPrice instanceof Decimal) invItem.costPrice = invItem.costPrice.toString();
                if (invItem.salesPrice instanceof Decimal) invItem.salesPrice = invItem.salesPrice.toString();
                if (invItem.quantityOnHand instanceof Decimal) invItem.quantityOnHand = invItem.quantityOnHand.toString();
                if (invItem.minimumStockLevel instanceof Decimal) invItem.minimumStockLevel = invItem.minimumStockLevel.toString();
                if (invItem.reorderLevel instanceof Decimal) invItem.reorderLevel = invItem.reorderLevel.toString();
                newItem.inventoryItem = invItem;
            }
            return newItem;
          });
        }

        // Order (if included and has Decimals)
        if (transformed.order) {
          const order = { ...transformed.order } as any;
          if (order.totalAmount instanceof Decimal) {
            order.totalAmount = order.totalAmount.toString();
          }
          // Order Items within Order
          if (order.items && Array.isArray(order.items)) {
            order.items = order.items.map((item: any) => {
              const newItem = { ...item };
              if (newItem.quantity instanceof Decimal) newItem.quantity = newItem.quantity.toString();
              if (newItem.unitPrice instanceof Decimal) newItem.unitPrice = newItem.unitPrice.toString();
              if (newItem.discountAmount instanceof Decimal) newItem.discountAmount = newItem.discountAmount.toString();
              if (newItem.discountPercentage instanceof Decimal) newItem.discountPercentage = newItem.discountPercentage.toString();
               // Decimal fields on nested inventoryItem within order item
              if (newItem.inventoryItem) {
                const invItem = { ...newItem.inventoryItem };
                if (invItem.costPrice instanceof Decimal) invItem.costPrice = invItem.costPrice.toString();
                if (invItem.salesPrice instanceof Decimal) invItem.salesPrice = invItem.salesPrice.toString();
                if (invItem.quantityOnHand instanceof Decimal) invItem.quantityOnHand = invItem.quantityOnHand.toString();
                if (invItem.minimumStockLevel instanceof Decimal) invItem.minimumStockLevel = invItem.minimumStockLevel.toString();
                if (invItem.reorderLevel instanceof Decimal) invItem.reorderLevel = invItem.reorderLevel.toString();
                newItem.inventoryItem = invItem;
              }
              return newItem;
            });
          }
          transformed.order = order;
        }
        
        // Payments (if included and has Decimals)
        if (transformed.payments && Array.isArray(transformed.payments)) {
            transformed.payments = transformed.payments.map((payment: any) => {
                const newPayment = { ...payment };
                if (newPayment.amount instanceof Decimal) newPayment.amount = newPayment.amount.toString();
                return newPayment;
            });
        }

        return transformed;
      };
      
      return transformInvoiceData(invoice);
    }),
    
  create: companyProtectedProcedure
    .input(CreateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { customerId, invoiceDate, dueDate, notes, items, orderId, vatReverseCharge, referenceNumber, sellerReference, complaintPeriod, penaltyInterest, deliveryMethod, ourReference, customerNumber, deliveryDate } = input;
      const userId = ctx.userId;

      // Fetch customer data to prefill invoice fields
      const customer = await prisma.customer.findUnique({
        where: { id: customerId, companyId: ctx.companyId },
      });

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      let subTotal = new Decimal(0); 
      let totalVatAmountValue = new Decimal(0);

      const inventoryItemIds = items.map(item => item.itemId);
      const inventoryItemsFromDb = await prisma.inventoryItem.findMany({
        where: {
          id: { in: inventoryItemIds },
        },
        select: { id: true, costPrice: true, itemType: true, salesPrice: true, defaultVatRatePercent: true },
      });
      // Explicitly define the type for the map's values
      type MappedInventoryItem = Pick<InventoryItem, 'id' | 'costPrice' | 'itemType' | 'salesPrice' | 'defaultVatRatePercent'>;
      const inventoryItemMap = new Map<string, MappedInventoryItem>(
        inventoryItemsFromDb.map((item): [string, MappedInventoryItem] => [item.id, item])
      );

      const invoiceItemsToCreate = await Promise.all(items.map(async (item: z.infer<typeof CreateInvoiceItemSchema>) => {
        const unitPrice = new Decimal(item.unitPrice); 
        const quantity = new Decimal(item.quantity);
        let lineNetUnitPrice = unitPrice; 

        if (item.discountPercent != null && item.discountPercent > 0) {
          const discountMultiplier = new Decimal(1).minus(new Decimal(item.discountPercent).div(100));
          lineNetUnitPrice = unitPrice.times(discountMultiplier);
        } else if (item.discountAmount != null && item.discountAmount > 0) {
          if (quantity.greaterThan(0)) {
            const perUnitDiscount = new Decimal(item.discountAmount).div(quantity);
            lineNetUnitPrice = unitPrice.sub(perUnitDiscount).greaterThanOrEqualTo(0) ? unitPrice.sub(perUnitDiscount) : new Decimal(0);
          }
        }
        
        const lineTotal = lineNetUnitPrice.times(quantity); 
        subTotal = subTotal.plus(lineTotal);

        let itemVat = new Decimal(0);
        if (!vatReverseCharge) {
          const vatRateForCalc = new Decimal(item.vatRatePercent);
          itemVat = lineTotal.times(vatRateForCalc.div(100));
          totalVatAmountValue = totalVatAmountValue.plus(itemVat);
        }

        const inventoryItemDetails = inventoryItemMap.get(item.itemId);
        if (!inventoryItemDetails) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Inventory item with ID ${item.itemId} not found.` });
        }
        
        // Use salesPrice as a fallback if unitPrice on item is not definitive or for reference
        const referenceUnitPrice = inventoryItemDetails.salesPrice ?? new Decimal(0);

        const calculatedUnitCost = inventoryItemDetails.costPrice ?? new Decimal(0); 
        const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
        const calculatedLineProfit = calculatedUnitProfit.times(quantity);

        return {
          inventoryItemId: item.itemId,
          description: item.description,
          quantity,
          unitPrice, 
          vatRatePercent: new Decimal(item.vatRatePercent),
          discountAmount: item.discountAmount != null ? new Decimal(item.discountAmount) : null,
          discountPercent: item.discountPercent != null ? new Decimal(item.discountPercent) : null,
          calculatedUnitCost,
          calculatedUnitProfit,
          calculatedLineProfit,
        };
      }));

      if (vatReverseCharge) {
        totalVatAmountValue = new Decimal(0); 
      }

      let nextInvoiceNumber = 'INV-00001'; 
      const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { createdAt: 'desc' }, 
        select: { invoiceNumber: true }
      });
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
            console.error("Failed to parse last invoice number:", nextInvoiceNumber, e);
        }
      }

      // Generate Finnish reference number if not provided
      let finalReferenceNumber = referenceNumber;
      if (!finalReferenceNumber) {
        try {
          finalReferenceNumber = generateInvoiceReferenceNumber(nextInvoiceNumber);
        } catch (error) {
          console.error("Failed to generate Finnish reference number:", error);
          finalReferenceNumber = undefined; // Let it be nullable in the database
        }
      }

      const dataForInvoiceCreate: Prisma.InvoiceCreateInput = {
        customer: { connect: { id: customerId } },
            invoiceNumber: nextInvoiceNumber,
            referenceNumber: finalReferenceNumber,
            sellerReference: sellerReference,
            invoiceDate,
            dueDate,
        status: InvoiceStatus.draft,
            notes,
        vatReverseCharge,
        totalAmount: subTotal, 
            totalVatAmount: totalVatAmountValue,
        // Use form values or fallback to customer defaults
        customerNumber: customerNumber ?? customer.customerNumber,
        ourReference: ourReference ?? customer.buyerReference, // Map buyerReference to ourReference
        // Use form values or reasonable defaults
        paymentTermsDays: customer.defaultPaymentTermsDays ?? 14, // Use customer's default or fallback to 14 days
        deliveryMethod: deliveryMethod ?? null,
        deliveryDate: deliveryDate ?? null,
        complaintPeriod: complaintPeriod ?? null,
        penaltyInterest: penaltyInterest ?? null,
        user: { connect: { id: userId } },
        Company: { connect: { id: ctx.companyId } },
        ...(orderId && { order: { connect: { id: orderId } } }),
            items: {
          create: invoiceItemsToCreate.map(item => ({
            inventoryItemId: item.inventoryItemId,
                description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRatePercent: item.vatRatePercent,
            discountAmount: item.discountAmount,
            discountPercentage: item.discountPercent,
            calculatedUnitCost: item.calculatedUnitCost,
            calculatedUnitProfit: item.calculatedUnitProfit,
            calculatedLineProfit: item.calculatedLineProfit,
              })),
            },
      };

      const newInvoice = await prisma.invoice.create({
        data: dataForInvoiceCreate,
        include: { items: true, customer: true },
      });

      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.invoiced },
        });
      }

      return newInvoice;
    }),

  createFromOrder: companyProtectedProcedure
    .input(createInvoiceFromOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const { orderId, invoiceDate, dueDate, notes, vatReverseCharge, referenceNumber, sellerReference } = input;
      const userId = ctx.userId;

      type OrderWithIncludes = Prisma.OrderGetPayload<{
        include: {
          customer: true,
          items: { include: { inventoryItem: true } }
        }
      }>;
      
      const order = await prisma.order.findUnique({
        where: { 
          id: orderId,
          companyId: ctx.companyId,
        },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: true
            }
          }
        }
      }) as OrderWithIncludes | null;

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }
      if (!order.customer) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order customer not found' });
      }

      let subTotal = new Decimal(0);
      let totalVatAmountValue = new Decimal(0);

      const caller = createAppCaller(ctx);
      let companyDefaultVatRate = new Decimal(0);
      try {
        const companySettings = await caller.settings.get();
        if (companySettings && companySettings.defaultVatRatePercent) {
          companyDefaultVatRate = new Decimal(companySettings.defaultVatRatePercent.toString());
        }
      } catch (error) {
        console.warn("Failed to fetch company settings for default VAT rate, using system default 0%:", error);
      }

      const invoiceItemsToCreate = order.items.map((orderItem: OrderItemWithInventory) => {
        if (!orderItem.inventoryItem) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Inventory item for order item ${orderItem.id} not found or not correctly included.`});
        }
        const unitPrice = orderItem.unitPrice ?? orderItem.inventoryItem.salesPrice ?? new Decimal(0);
        const quantity = new Decimal(orderItem.quantity);
        const lineTotal = unitPrice.times(quantity);
        subTotal = subTotal.plus(lineTotal);

        let itemVat = new Decimal(0);
        const vatRateForCalc = orderItem.vatRatePercent !== null && orderItem.vatRatePercent !== undefined 
          ? new Decimal(orderItem.vatRatePercent.toString()) 
          : orderItem.inventoryItem.defaultVatRatePercent !== null && orderItem.inventoryItem.defaultVatRatePercent !== undefined 
          ? new Decimal(orderItem.inventoryItem.defaultVatRatePercent.toString()) 
          : companyDefaultVatRate;
        
        if (!vatReverseCharge) {
          itemVat = lineTotal.times(vatRateForCalc.div(100));
          totalVatAmountValue = totalVatAmountValue.plus(itemVat);
        }
        
        const calculatedUnitCost = orderItem.inventoryItem.costPrice ?? new Decimal(0);
        const calculatedUnitProfit = unitPrice.minus(calculatedUnitCost);
        const calculatedLineProfit = calculatedUnitProfit.times(quantity);

        return {
          inventoryItemId: orderItem.inventoryItemId,
          description: orderItem.inventoryItem.name,
          quantity,
          unitPrice,
          vatRatePercent: vatRateForCalc, 
          discountAmount: orderItem.discountAmount,
          discountPercentage: orderItem.discountPercentage,
          calculatedUnitCost,
          calculatedUnitProfit,
          calculatedLineProfit,
        };
      });
      
      if (vatReverseCharge) {
        totalVatAmountValue = new Decimal(0);
      }

      let nextInvoiceNumber = 'INV-00001';
      const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true }
      });
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
        }
      }

      // Generate Finnish reference number if not provided
      let finalReferenceNumber = referenceNumber;
      if (!finalReferenceNumber) {
        try {
          finalReferenceNumber = generateInvoiceReferenceNumber(nextInvoiceNumber);
        } catch (error) {
          console.error("Failed to generate Finnish reference number:", error);
          finalReferenceNumber = undefined; // Let it be nullable in the database
        }
      }

      const dataForInvoiceCreate: Prisma.InvoiceCreateInput = {
        customer: { connect: { id: order.customerId } },
        invoiceNumber: nextInvoiceNumber,
        referenceNumber: finalReferenceNumber,
        sellerReference: sellerReference,
        invoiceDate: invoiceDate,
        dueDate: dueDate,
        status: InvoiceStatus.draft,
        notes: notes,
        vatReverseCharge: vatReverseCharge,
        totalAmount: subTotal,
        totalVatAmount: totalVatAmountValue,
        // Copy missing fields from order
        ourReference: order.ourReference,
        customerNumber: order.customerNumber,
        user: { connect: { id: userId } },
        Company: { connect: { id: ctx.companyId } },
        order: { connect: { id: orderId } },
        items: {
          create: invoiceItemsToCreate.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRatePercent: item.vatRatePercent,
            discountAmount: item.discountAmount,
            discountPercentage: item.discountPercentage,
            calculatedUnitCost: item.calculatedUnitCost,
            calculatedUnitProfit: item.calculatedUnitProfit,
            calculatedLineProfit: item.calculatedLineProfit,
          })),
        },
      };
      
      const newInvoice = await prisma.$transaction(async (tx) => {
        const createdInvoice = await tx.invoice.create({
          data: dataForInvoiceCreate,
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.invoiced },
        });
        
        return createdInvoice;
      });

      return newInvoice;
    }),

  generateFinvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { invoiceId } = input;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: { include: { addresses: true } },
          items: { include: { inventoryItem: true } },
          order: true,
          payments: true, 
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      }

      const caller = createAppCaller(ctx); 
      let companySettings;
      try {
        companySettings = await caller.settings.get();
      } catch (error) {
        console.error("Failed to fetch company settings:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch company settings for Finvoice generation. Ensure settings are configured.",
        });
      }
      
      if (!companySettings) {
        throw new TRPCError({ 
          code: "PRECONDITION_FAILED", 
          message: "Company settings for Finvoice generation are not configured. Please configure them in the settings page."
        });
      }
      
      type InvoiceItemForXml = Prisma.InvoiceItemGetPayload<{ include: { inventoryItem: true } }>;

      const mappedInvoiceForXml: import('@/lib/types/invoice.types').Invoice = {
        id: invoice.id as import('@/lib/types/branded').UUID,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status as import('@/lib/types/invoice.types').InvoiceStatus, 
        totalAmount: invoice.totalAmount as unknown as import('@/lib/types/branded').Decimal,
        totalVatAmount: invoice.totalVatAmount as unknown as import('@/lib/types/branded').Decimal,
        vatReverseCharge: invoice.vatReverseCharge,
        notes: invoice.notes ?? undefined,
        // Payment information available through payments relation 
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        customerId: invoice.customerId as import('@/lib/types/branded').UUID,
        customer: {
          id: invoice.customer.id as import('@/lib/types/branded').UUID,
          name: invoice.customer.name,
          email: invoice.customer.email,
          phone: invoice.customer.phone,
          vatId: invoice.customer.vatId,
          ovtIdentifier: invoice.customer.ovtIdentifier,
          intermediatorAddress: invoice.customer.intermediatorAddress,
          createdAt: invoice.customer.createdAt,
          updatedAt: invoice.customer.updatedAt,
          addresses: invoice.customer.addresses.map((addr: Address) => ({
            id: addr.id as import('@/lib/types/branded').UUID,
            type: addr.type as import('@/lib/types/customer.types').AddressType, 
            streetAddress: addr.streetAddress,
            city: addr.city,
            postalCode: addr.postalCode,
            countryCode: addr.countryCode,
          })),
        },
        items: invoice.items.map((item: InvoiceItemForXml) => ({
          id: item.id as import('@/lib/types/branded').UUID,
          invoiceId: item.invoiceId as import('@/lib/types/branded').UUID,
          description: item.description ?? item.inventoryItem?.name ?? 'N/A',
          quantity: item.quantity as unknown as import('@/lib/types/branded').Decimal,
          unitPrice: item.unitPrice as unknown as import('@/lib/types/branded').Decimal,
          vatRatePercent: item.vatRatePercent as unknown as import('@/lib/types/branded').Decimal,
          discountAmount: item.discountAmount as unknown as import('@/lib/types/branded').Decimal ?? null,
          discountPercent: item.discountPercentage as unknown as import('@/lib/types/branded').Decimal ?? null, 
        })),
        orderId: invoice.orderId as import('@/lib/types/branded').UUID ?? undefined,
        order: invoice.order ? {
          id: invoice.order.id as import('@/lib/types/branded').UUID,
          orderNumber: invoice.order.orderNumber,
          createdAt: invoice.order.orderDate, 
          customerId: invoice.order.customerId as import('@/lib/types/branded').UUID,
          status: invoice.order.status as import('@/lib/types/order.types').OrderStatus,
          totalAmount: invoice.order.totalAmount as unknown as import('@/lib/types/branded').Decimal, 
          notes: invoice.order.notes ?? undefined,
          updatedAt: invoice.order.updatedAt,
          customer: { 
            id: invoice.order.customerId as import('@/lib/types/branded').UUID, 
            name: invoice.customer.name, 
            addresses: [], 
          } as import('@/lib/types/customer.types').Customer, 
          items: [], 
        } : undefined,
      };

      const mappedSettingsForXml: SellerSettings = {
        companyName: companySettings.companyName ?? "Missing Company Name",
        vatId: companySettings.vatId ?? "Missing VAT ID", 
        domicile: companySettings.domicile ?? "Missing Domicile", 
        streetAddress: companySettings.streetAddress ?? "Missing Street Address", 
        postalCode: companySettings.postalCode ?? "Missing Postal Code", 
        city: companySettings.city ?? "Missing City", 
        countryCode: companySettings.countryCode ?? "FI", 
        countryName: companySettings.countryName ?? "Finland", 
        bankAccountIBAN: companySettings.bankAccountIBAN ?? "Missing IBAN", 
        bankAccountBIC: companySettings.bankAccountBIC ?? "Missing BIC", 

        website: companySettings.website || undefined,
        sellerIdentifier: companySettings.sellerIdentifier || undefined,
        sellerIntermediatorAddress: companySettings.sellerIntermediatorAddress || undefined,
        bankName: companySettings.bankName || undefined,
      };

      try {
        const xmlString = generateFinvoiceXml(mappedInvoiceForXml, mappedSettingsForXml);
        return { xmlString };
      } catch (error: any) {
        console.error("Error generating Finvoice XML:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to generate Finvoice XML.",
        });
      }
    }),

  createPartialCreditNote: companyProtectedProcedure
    .input(CreatePartialCreditNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const { originalInvoiceId, notes, items } = input;
      
      return await prisma.$transaction(async (tx) => {
        // Get the original invoice
        const originalInvoice = await tx.invoice.findUnique({
          where: { 
            id: originalInvoiceId,
            companyId: ctx.companyId,
          },
          include: {
            items: { include: { inventoryItem: true } },
            customer: true,
          },
        });

        if (!originalInvoice) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Original invoice not found',
          });
        }

        if (originalInvoice.isCreditNote) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot create a credit note from another credit note',
          });
        }

        // Generate credit note number
        const creditNoteNumber = await generateInvoiceNumber(tx);
        
        // Calculate total credit amounts
        const totalCreditAmount = items.reduce((sum, item) => sum + item.creditAmount, 0);
        const totalCreditVatAmount = items.reduce((sum, item) => sum + item.creditVatAmount, 0);
        
        // Create the partial credit note
        const creditNote = await tx.invoice.create({
          data: {
            companyId: ctx.companyId,
            customerId: originalInvoice.customerId,
            invoiceNumber: creditNoteNumber,
            invoiceDate: new Date(),
            dueDate: new Date(),
            status: InvoiceStatus.draft,
            notes: notes || `Partial credit note for invoice ${originalInvoice.invoiceNumber}`,
            isCreditNote: true,
            originalInvoiceId: originalInvoice.id,
            totalAmount: new Decimal(-totalCreditAmount), // Negative for credit
            totalVatAmount: new Decimal(-totalCreditVatAmount), // Negative for credit
            items: {
              create: items.map((item) => {
                // Find the original item to get inventory details
                const originalItem = originalInvoice.items.find(i => i.id === item.originalItemId);
                if (!originalItem) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Original item ${item.originalItemId} not found`,
                  });
                }
                
                // Calculate credit quantity based on credit amount and original unit price
                const creditQuantity = item.originalUnitPrice > 0 
                  ? -(item.creditAmount / item.originalUnitPrice)
                  : -1; // Default to -1 if unit price is 0
                
                return {
                  inventoryItem: { connect: { id: originalItem.inventoryItemId } },
                  description: item.description,
                  quantity: new Decimal(creditQuantity),
                  unitPrice: originalItem.unitPrice,
                  vatRatePercent: originalItem.vatRatePercent,
                  discountAmount: originalItem.discountAmount,
                  discountPercentage: originalItem.discountPercentage,
                };
              }),
            },
          },
          include: {
            customer: true,
            items: { include: { inventoryItem: true } },
          },
        });

        return creditNote;
      });
    }),

  generatePdf: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { companyId } = ctx;

      // Verify invoice exists and belongs to company
      const invoice = await prisma.invoice.findUnique({
        where: { 
          id,
          companyId 
        }
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found"
        });
      }

      // Trigger PDF generation as background job
      await triggerInvoicePdfGeneration(id, companyId);

      return {
        success: true,
        message: "PDF generation started",
        invoiceId: id
      };
    }),

  update: protectedProcedure
    .input(UpdateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...invoiceData } = input;
      const userId = ctx.session.user.id;

      if (!id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invoice ID is required for an update.' });
      }

      await prisma.$transaction(async (tx) => {
        const existingInvoice = await tx.invoice.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existingInvoice) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found for update' });
        }

        const updates: Prisma.InvoiceUpdateInput = { ...invoiceData };
        
        if (items) {
          let subTotal = new Decimal(0);
          let totalVatAmountValue = new Decimal(0);

          const inventoryItemIds = items.map(item => item.itemId);
          const inventoryItemsFromDb = await tx.inventoryItem.findMany({
              where: { id: { in: inventoryItemIds } },
              select: { id: true, costPrice: true },
          });
          
          const inventoryItemMap = new Map<string, any>(
              inventoryItemsFromDb.map(item => [item.id, item])
          );

          // Delete items that are not in the input array
          const inputItemIds = new Set(items.map(i => i.id).filter(Boolean));
          const itemsToDelete = existingInvoice.items.filter(i => !inputItemIds.has(i.id));
          if (itemsToDelete.length > 0) {
            await tx.invoiceItem.deleteMany({ where: { id: { in: itemsToDelete.map(i => i.id) } } });
          }

          for (const item of items) {
            const unitPrice = new Decimal(item.unitPrice);
            const quantity = new Decimal(item.quantity);
            let lineNetUnitPrice = unitPrice;

            if (item.discountPercent != null && item.discountPercent > 0) {
                const discountMultiplier = new Decimal(1).minus(new Decimal(item.discountPercent).div(100));
                lineNetUnitPrice = unitPrice.times(discountMultiplier);
            } else if (item.discountAmount != null && item.discountAmount > 0) {
                if (quantity.greaterThan(0)) {
                    const perUnitDiscount = new Decimal(item.discountAmount).div(quantity);
                    lineNetUnitPrice = unitPrice.sub(perUnitDiscount).greaterThanOrEqualTo(0) ? unitPrice.sub(perUnitDiscount) : new Decimal(0);
                }
            }

            const lineTotal = lineNetUnitPrice.times(quantity);
            subTotal = subTotal.plus(lineTotal);
            
            let itemVat = new Decimal(0);
            if (!invoiceData.vatReverseCharge) {
                const vatRateForCalc = new Decimal(item.vatRatePercent);
                itemVat = lineTotal.times(vatRateForCalc.div(100));
                totalVatAmountValue = totalVatAmountValue.plus(itemVat);
            }

            const inventoryItemDetails = inventoryItemMap.get(item.itemId);
            const calculatedUnitCost = inventoryItemDetails?.costPrice ?? new Decimal(0);
            const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
            const calculatedLineProfit = calculatedUnitProfit.times(quantity);

            const itemData = {
                inventoryItemId: item.itemId,
                description: item.description,
                quantity,
                unitPrice,
                vatRatePercent: new Decimal(item.vatRatePercent),
                discountAmount: item.discountAmount != null ? new Decimal(item.discountAmount) : null,
                discountPercentage: item.discountPercent != null ? new Decimal(item.discountPercent) : null,
                calculatedUnitCost,
                calculatedUnitProfit,
                calculatedLineProfit,
            };

            if (item.id) { // Existing item -> update
              await tx.invoiceItem.update({
                where: { id: item.id },
                data: itemData,
              });
            } else { // New item -> create
              await tx.invoiceItem.create({
                data: {
                  ...itemData,
                  invoiceId: id,
                }
              });
            }
          }
          
          updates.totalAmount = subTotal;
          updates.totalVatAmount = totalVatAmountValue;
        }

        if (invoiceData.status && invoiceData.status !== existingInvoice.status) {
            // Status changes are handled by just updating the status field
            // For 'paid' status, payments should be recorded via the Payment model
            // No additional fields needed on Invoice model for status tracking
        }

        await tx.invoice.update({
          where: { id },
          data: updates,
        });
      });

      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id },
        include: { 
            customer: true, 
            items: { include: { inventoryItem: true } }, 
            order: true,
            payments: true,
        }
      });
      if (!updatedInvoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Updated invoice not found.' });

      return updatedInvoice;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.invoice.delete({
        where: { 
          id: input.id,
        },
      });
      return { success: true, id: input.id };
    }),

  updateStatus: companyProtectedProcedure
    .input(z.object({ 
      id: z.string().cuid(),
      status: z.nativeEnum(InvoiceStatus)
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, status } = input;

      const invoice = await prisma.invoice.findUnique({ 
        where: { 
          id,
          companyId: ctx.companyId,
        } 
      });
      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      const updateData: any = { status };
      
      // For 'paid' status, create a payment record automatically
      if (status === InvoiceStatus.paid) {
        // Check if a payment already exists for the full amount
        const existingPayments = await prisma.payment.findMany({
          where: { invoiceId: id },
        });
        
        const totalPaid = existingPayments.reduce((sum, payment) => 
          sum.plus(payment.amount), new Decimal(0)
        );
        
        // Only create payment if not already fully paid
        if (totalPaid.lt(invoice.totalAmount)) {
          const remainingAmount = new Decimal(invoice.totalAmount).minus(totalPaid);
          await prisma.payment.create({
            data: {
              invoiceId: id,
              amount: remainingAmount,
              paymentDate: new Date(),
              notes: 'Automatically recorded when status changed to paid',
            },
          });
        }
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { 
          id,
          companyId: ctx.companyId,
        },
        data: updateData,
      });

      return updatedInvoice;
    }),

  createReminder: companyProtectedProcedure
    .input(z.object({
      originalInvoiceId: z.string().cuid(),
      includePenaltyInterest: z.boolean(),
      includeReminderFee: z.boolean(),
      reminderFeeAmount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { originalInvoiceId, includePenaltyInterest, includeReminderFee, reminderFeeAmount } = input;
      const userId = ctx.session.user.id;

      // Get the original invoice with all necessary data
      const originalInvoice = await prisma.invoice.findUnique({
        where: { 
          id: originalInvoiceId,
          companyId: ctx.companyId,
        },
        include: {
          customer: true,
          items: { include: { inventoryItem: true } },
          Company: true,
        },
      });

      if (!originalInvoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Original invoice not found',
        });
      }

      // Calculate the next reminder sequence number
      const existingReminders = await prisma.invoice.count({
        where: {
          originalInvoiceId: originalInvoiceId,
          isReminder: true,
          companyId: ctx.companyId,
        },
      });
      const reminderSequence = existingReminders + 1;

      // Generate reminder invoice number
      const reminderInvoiceNumber = `${originalInvoice.invoiceNumber}-${reminderSequence.toString().padStart(2, '0')}`;

      return await prisma.$transaction(async (tx) => {
        // Calculate penalty interest if requested
        let penaltyInterestAmount = 0;
        if (includePenaltyInterest && originalInvoice.penaltyInterest) {
          const dueDate = new Date(originalInvoice.dueDate);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          
          // Calculate penalty interest: (amount * rate * days) / (365 * 100)
          penaltyInterestAmount = (Number(originalInvoice.totalAmount) * Number(originalInvoice.penaltyInterest) * daysOverdue) / (365 * 100);
          penaltyInterestAmount = Math.round(penaltyInterestAmount * 100) / 100; // Round to 2 decimals
        }

        // Prepare reminder invoice items (copy original items)
        const reminderItems = originalInvoice.items.map(item => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRatePercent: item.vatRatePercent,
          discountAmount: item.discountAmount,
          discountPercentage: item.discountPercentage,
        }));

        // For now, we'll skip adding penalty interest and reminder fee as separate line items
        // and instead calculate them into the total. This avoids the inventoryItemId requirement.
        // In a future version, we could create special service inventory items for these.
        
        let additionalAmount = 0;
        if (includePenaltyInterest && penaltyInterestAmount > 0) {
          additionalAmount += penaltyInterestAmount;
        }
        if (includeReminderFee && reminderFeeAmount && reminderFeeAmount > 0) {
          additionalAmount += reminderFeeAmount;
        }

        // Calculate totals
        const itemsSubTotal = reminderItems.reduce((sum, item) => {
          const itemTotal = Number(item.unitPrice) * Number(item.quantity);
          const discountAmount = Number(item.discountAmount || 0);
          const discountPercent = Number(item.discountPercentage || 0);
          const afterDiscount = itemTotal - discountAmount - (itemTotal * discountPercent / 100);
          return sum + afterDiscount;
        }, 0);
        
        const itemsVatAmount = reminderItems.reduce((sum, item) => {
          const itemTotal = Number(item.unitPrice) * Number(item.quantity);
          const discountAmount = Number(item.discountAmount || 0);
          const discountPercent = Number(item.discountPercentage || 0);
          const afterDiscount = itemTotal - discountAmount - (itemTotal * discountPercent / 100);
          const vatAmount = afterDiscount * (Number(item.vatRatePercent) / 100);
          return sum + vatAmount;
        }, 0);
        
        // Add additional amounts (penalty interest is VAT-free, reminder fee has VAT)
        const reminderFeeVat = includeReminderFee && reminderFeeAmount ? reminderFeeAmount * 0.24 : 0;
        const subTotal = itemsSubTotal + additionalAmount + reminderFeeVat;
        const totalVatAmount = itemsVatAmount + reminderFeeVat;

        // Generate reference number for the reminder
        const referenceNumber = generateInvoiceReferenceNumber(reminderInvoiceNumber);

        // Create the reminder invoice
        const reminderInvoice = await tx.invoice.create({
          data: {
            invoiceNumber: reminderInvoiceNumber,
            customerId: originalInvoice.customerId,
            status: InvoiceStatus.draft,
            invoiceDate: new Date(),
            dueDate: new Date(), // "heti" - same day as created
            notes: `Maksumuistutus laskusta ${originalInvoice.invoiceNumber}`,
            vatReverseCharge: originalInvoice.vatReverseCharge,
            isReminder: true,
            reminderSequence: reminderSequence,
            originalInvoiceId: originalInvoiceId,
            totalAmount: new Decimal(subTotal),
            totalVatAmount: new Decimal(totalVatAmount),
            userId: userId,
            companyId: ctx.companyId,
            referenceNumber: referenceNumber,
            deliveryMethod: originalInvoice.deliveryMethod,
            complaintPeriod: originalInvoice.complaintPeriod,
            penaltyInterest: originalInvoice.penaltyInterest,
            ourReference: originalInvoice.ourReference,
            customerNumber: originalInvoice.customerNumber,
            paymentTermsDays: 0, // "heti" - immediate payment
            sellerReference: originalInvoice.sellerReference,
            deliveryDate: new Date(),
            items: {
              create: reminderItems,
            },
          },
          include: {
            customer: true,
            items: { include: { inventoryItem: true } },
            Company: true,
          },
        });

        return reminderInvoice;
      });
    }),

}); 