import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { CreateInvoiceSchema, UpdateInvoiceSchema, invoiceFilterSchema, invoicePaginationSchema, createInvoiceFromOrderSchema, type CreateInvoiceItemSchema, type UpdateInvoiceItemSchema } from "@/lib/schemas/invoice.schema";
import { Prisma, PrismaClient, InvoiceStatus, OrderStatus, type OrderItem, type InventoryItem, type ItemType, type Address, type InvoiceItem as PrismaInvoiceItem } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; 
import { prisma } from "@/lib/db"; 
import { generateFinvoiceXml, type SellerSettings } from "@/lib/services/finvoice.service"; 
import { createAppCaller } from "@/lib/api/root"; 

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
    case 'customerName': 
    return { customer: { name: direction } };
    default:
  return { invoiceDate: direction }; 
  }
};

const listInvoicesInputSchema = invoicePaginationSchema.merge(invoiceFilterSchema);

export const invoiceRouter = createTRPCRouter({
  list: protectedProcedure
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

      const whereClause: Prisma.InvoiceWhereInput = {};

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
          include: {
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

  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: input.id,
        },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: true, 
            },
          },
          order: true,
          payments: true, 
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
    
  create: protectedProcedure
    .input(CreateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { customerId, invoiceDate, dueDate, notes, items, orderId, vatReverseCharge } = input;
      const userId = ctx.session.user.id;

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
            console.error("Failed to parse last invoice number:", lastInvoice.invoiceNumber, e);
        }
      }

      const dataForInvoiceCreate: Prisma.InvoiceCreateInput = {
        customer: { connect: { id: customerId } },
            invoiceNumber: nextInvoiceNumber,
            invoiceDate,
            dueDate,
        status: InvoiceStatus.draft,
            notes,
        vatReverseCharge,
        totalAmount: subTotal, 
            totalVatAmount: totalVatAmountValue, 
        user: { connect: { id: userId } },
        ...(orderId && { order: { connect: { id: orderId } } }),
            items: {
          create: invoiceItemsToCreate.map(item => ({
            inventoryItemId: item.inventoryItemId,
                description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRatePercent: item.vatRatePercent,
            discountAmount: item.discountAmount,
            discountPercent: item.discountPercent,
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
          data: { status: OrderStatus.INVOICED },
        });
      }

      return newInvoice;
    }),

  createFromOrder: protectedProcedure
    .input(createInvoiceFromOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const { orderId, invoiceDate, dueDate, notes, vatReverseCharge } = input;
      const userId = ctx.session.user.id;

      type OrderWithIncludes = Prisma.OrderGetPayload<{
        include: {
          customer: true,
          items: { include: { inventoryItem: true } }
        }
      }>;
      
      type OrderItemWithInventory = Prisma.OrderItemGetPayload<{
        include: { inventoryItem: true }
      }>;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: { 
                select: { 
                  id: true, 
                  name: true, 
                  salesPrice: true, 
                  costPrice: true, 
                  defaultVatRatePercent: true // Added this line
                }
              }
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
      if (order.status === OrderStatus.cancelled || order.status === OrderStatus.draft) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Order status is ${order.status}, cannot create invoice.` });
      }

      let subTotal = new Decimal(0);
      let totalVatAmountValue = new Decimal(0);

      // TODO: Fetch company default VAT rate if inventory item VAT is not set
      const companyDefaultVatRate = new Decimal(25.5); // Placeholder

      const invoiceItemsToCreate = order.items.map((orderItem: OrderItemWithInventory) => {
        if (!orderItem.inventoryItem) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Inventory item for order item ${orderItem.id} not found or not correctly included.`});
        }
        const unitPrice = orderItem.unitPrice ?? orderItem.inventoryItem.salesPrice ?? new Decimal(0);
        const quantity = new Decimal(orderItem.quantity);
        const lineTotal = unitPrice.times(quantity);
        subTotal = subTotal.plus(lineTotal);

        let itemVat = new Decimal(0);
        // Use inventory item's default VAT rate, fallback to company default
        const vatRateForCalc = orderItem.inventoryItem.defaultVatRatePercent ?? companyDefaultVatRate;
        
        if (!vatReverseCharge) {
          itemVat = lineTotal.times(vatRateForCalc.div(100));
          totalVatAmountValue = totalVatAmountValue.plus(itemVat);
        }
        
        const calculatedUnitCost = orderItem.inventoryItem.costPrice ?? new Decimal(0);
        const calculatedUnitProfit = unitPrice.minus(calculatedUnitCost);
        const calculatedLineProfit = calculatedUnitProfit.times(quantity);

        return {
          inventoryItemId: orderItem.inventoryItemId,
          description: orderItem.inventoryItem.name, // Using inventory item name as description
          quantity,
          unitPrice,
          vatRatePercent: vatRateForCalc, 
          // Discounts are not directly transferred from order items in this version
          discountAmount: null, 
          discountPercent: null,
          calculatedUnitCost,
          calculatedUnitProfit,
          calculatedLineProfit,
          orderItemId: orderItem.id, // Link to original order item
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
            const paddingLength = lastNumericString.length > 0 ? lastNumericString.length : 5; // Default to 5 if no numeric part found
            nextInvoiceNumber = prefix + newNumericPart.toString().padStart(paddingLength, '0');
        } catch (e) {
            console.error("Failed to parse last invoice number:", lastInvoice.invoiceNumber, e);
            // Fallback or re-throw error if critical
        }
      }

      const dataForInvoiceCreate: Prisma.InvoiceCreateInput = {
        customer: { connect: { id: order.customerId } },
        invoiceNumber: nextInvoiceNumber,
        invoiceDate,
        dueDate,
        status: InvoiceStatus.draft,
        notes,
        vatReverseCharge,
        totalAmount: subTotal,
        totalVatAmount: totalVatAmountValue,
        user: { connect: { id: userId } },
        order: { connect: { id: orderId } },
        items: {
          create: invoiceItemsToCreate.map((item: { // Added explicit type here
            inventoryItemId: string;
            description: string;
            quantity: Decimal;
            unitPrice: Decimal;
            vatRatePercent: Decimal;
            discountAmount: Decimal | null;
            discountPercent: Decimal | null;
            calculatedUnitCost: Decimal;
            calculatedUnitProfit: Decimal;
            calculatedLineProfit: Decimal;
            orderItemId: string;
          }) => ({
            inventoryItemId: item.inventoryItemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRatePercent: item.vatRatePercent,
            discountAmount: item.discountAmount,
            discountPercent: item.discountPercent,
            calculatedUnitCost: item.calculatedUnitCost,
            calculatedUnitProfit: item.calculatedUnitProfit,
            calculatedLineProfit: item.calculatedLineProfit,
            orderItem: { connect: { id: item.orderItemId } },
          })),
        },
      };
      
      const newInvoice = await prisma.$transaction(async (tx) => {
        const createdInvoice = await tx.invoice.create({
          data: dataForInvoiceCreate,
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.INVOICED },
        });
        
        // Create audit log entry for invoice creation
        // await tx.auditLog.create({ ... });
        
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
        paymentDate: invoice.payments?.[0]?.paymentDate ?? undefined, 
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

  update: protectedProcedure
    .input(UpdateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, items: inputItems, ...restOfInput } = input;
      const userId = ctx.session.user.id;

      // Fetch the existing invoice to ensure it exists and for audit/comparison if needed
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id },
        include: { items: true } 
      });

      if (!existingInvoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }
      
      // Forbid editing if invoice is not in draft status
      if (existingInvoice.status !== InvoiceStatus.draft) {
          throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invoice cannot be updated as its status is '${existingInvoice.status}'. Only draft invoices can be edited.`,
          });
      }


      let subTotal = new Decimal(0);
      let totalVatAmountValue = new Decimal(0);
      let invoiceItemsToCreateOrUpdate: Prisma.InvoiceItemUncheckedCreateNestedManyWithoutInvoiceInput | Prisma.InvoiceItemUpdateManyWithoutInvoiceNestedInput | undefined = undefined;


      if (inputItems && inputItems.length > 0) {
        const inventoryItemIds = inputItems.map(item => item.itemId).filter(id => id) as string[];
        
        const inventoryItemsFromDb = await prisma.inventoryItem.findMany({
          where: { id: { in: inventoryItemIds } },
          select: { id: true, costPrice: true, itemType: true, salesPrice: true, defaultVatRatePercent: true },
        });
        // Explicitly define the type for the map's values
        type MappedUpdateInventoryItem = Pick<InventoryItem, 'id' | 'costPrice' | 'itemType' | 'salesPrice' | 'defaultVatRatePercent'>;
        const inventoryItemMap = new Map<string, MappedUpdateInventoryItem>(
          inventoryItemsFromDb.map((dbItem): [string, MappedUpdateInventoryItem] => [dbItem.id, dbItem])
        );
        
        // TODO: Fetch company default VAT rate if inventory item VAT is not set
        const companyDefaultVatRate = new Decimal(25.5); // Placeholder
        
        const processedItems = await Promise.all(inputItems.map(async (item: z.infer<typeof UpdateInvoiceItemSchema>) => {
          const unitPrice = new Decimal(item.unitPrice);
          const quantity = new Decimal(item.quantity);
          let lineNetUnitPrice = unitPrice;

          if (item.discountPercent != null && item.discountPercent > 0) {
            const discountMultiplier = new Decimal(1).minus(new Decimal(item.discountPercent).div(100));
            lineNetUnitPrice = unitPrice.times(discountMultiplier);
          } else if (item.discountAmount != null && item.discountAmount > 0) {
            if (quantity.greaterThan(0)) {
              // Ensure item.discountAmount is a number before creating Decimal
              const discountAmountValue = typeof item.discountAmount === 'number' ? item.discountAmount : 0;
              const perUnitDiscount = new Decimal(discountAmountValue).div(quantity);
              lineNetUnitPrice = unitPrice.sub(perUnitDiscount).greaterThanOrEqualTo(0) ? unitPrice.sub(perUnitDiscount) : new Decimal(0);
            }
          }

          const lineTotal = lineNetUnitPrice.times(quantity);
          subTotal = subTotal.plus(lineTotal);

          let itemVat = new Decimal(0);
          const vatRateForCalc = item.vatRatePercent !== undefined ? new Decimal(item.vatRatePercent) : 
                                 (item.itemId ? inventoryItemMap.get(item.itemId)?.defaultVatRatePercent : undefined) ?? companyDefaultVatRate;

          if (!input.vatReverseCharge && vatRateForCalc) { // Check input.vatReverseCharge instead of existingInvoice.vatReverseCharge
            itemVat = lineTotal.times(vatRateForCalc.div(100));
            totalVatAmountValue = totalVatAmountValue.plus(itemVat);
          }
          
          const inventoryItemDetails = item.itemId ? inventoryItemMap.get(item.itemId) : null;
          // salesPrice can be used as a reference or fallback if needed
          const referenceUnitPrice = inventoryItemDetails?.salesPrice ?? new Decimal(0);


          const calculatedUnitCost = inventoryItemDetails?.costPrice ?? new Decimal(0);
          const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
          const calculatedLineProfit = calculatedUnitProfit.times(quantity);
          
          const itemData = {
            description: item.description,
            quantity,
            unitPrice,
            vatRatePercent: vatRateForCalc ?? new Decimal(0), // Ensure vatRatePercent is always a Decimal
            discountAmount: item.discountAmount != null ? new Decimal(item.discountAmount) : null,
            discountPercent: item.discountPercent != null ? new Decimal(item.discountPercent) : null,
            calculatedUnitCost,
            calculatedUnitProfit,
            calculatedLineProfit,
            ...(item.itemId && { inventoryItemId: item.itemId }), 
          };

          if (item.id) { // Existing item, prepare for update
            return { where: { id: item.id }, data: itemData };
          } else { // New item, prepare for create
            if (!item.itemId) { // New items must have an itemId
                 throw new TRPCError({ code: 'BAD_REQUEST', message: `New invoice item must have an itemId.` });
            }
            return { ...itemData, inventoryItemId: item.itemId }; // Ensure inventoryItemId is included for creation
          }
        }));

        const itemsToUpdate = processedItems.filter(item => 'where' in item) as { where: { id: string }, data: any }[];
        const itemsToCreate = processedItems.filter(item => !('where' in item)) as any[];


        invoiceItemsToCreateOrUpdate = {
          ...(itemsToCreate.length > 0 && { create: itemsToCreate.map(item => ({ // Added explicit type here
             inventoryItemId: item.inventoryItemId,
             description: item.description,
             quantity: item.quantity,
             unitPrice: item.unitPrice,
             vatRatePercent: item.vatRatePercent,
             discountAmount: item.discountAmount,
             discountPercent: item.discountPercent,
             calculatedUnitCost: item.calculatedUnitCost,
             calculatedUnitProfit: item.calculatedUnitProfit,
             calculatedLineProfit: item.calculatedLineProfit,
          }))}),
          ...(itemsToUpdate.length > 0 && { update: itemsToUpdate.map(item => ({ where: item.where, data: item.data })) }),
        };
        
        // Handle deletion of items not present in the input
        const inputItemIds = inputItems.map(i => i.id).filter(id => id) as string[];
        const itemsToDelete = existingInvoice.items.filter(existingItem => !inputItemIds.includes(existingItem.id));
        if (itemsToDelete.length > 0) {
          if (!invoiceItemsToCreateOrUpdate) invoiceItemsToCreateOrUpdate = {}; // Initialize if undefined
          (invoiceItemsToCreateOrUpdate as Prisma.InvoiceItemUpdateManyWithoutInvoiceNestedInput).deleteMany = itemsToDelete.map(item => ({ id: item.id }));
        }

      } else if (inputItems && inputItems.length === 0) { // If items array is empty, delete all existing items
          invoiceItemsToCreateOrUpdate = {
              deleteMany: { invoiceId: id },
          };
          subTotal = new Decimal(0);
          totalVatAmountValue = new Decimal(0);
      }
      // If inputItems is undefined, items are not being changed, so subTotal and totalVatAmountValue will also remain unchanged unless explicitly recalculated or passed in input.
      // For this implementation, if inputItems is undefined, we do not modify existing items or totals based on items.
      // Client should send empty array [] to clear items, or full array to update/replace.

      const dataForUpdate: Prisma.InvoiceUpdateInput = {
        ...restOfInput,
        ...(inputItems && { // Only update totals if items were part of the input
            totalAmount: subTotal,
            totalVatAmount: totalVatAmountValue,
        }),
        ...(invoiceItemsToCreateOrUpdate && { items: invoiceItemsToCreateOrUpdate }),
      };
      
      // Remove undefined fields from dataForUpdate to prevent Prisma errors
      Object.keys(dataForUpdate).forEach(key => {
        if (dataForUpdate[key as keyof typeof dataForUpdate] === undefined) {
          delete dataForUpdate[key as keyof typeof dataForUpdate];
        }
      });

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: dataForUpdate,
        include: {
          customer: true,
          items: { include: { inventoryItem: true }}, // Also include inventoryItem for consistency
        },
      });

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

}); 