import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { CreateInvoiceSchema, UpdateInvoiceSchema, invoiceFilterSchema, invoicePaginationSchema, createInvoiceFromOrderSchema } from "@/lib/schemas/invoice.schema";
import { InvoiceStatus, OrderStatus, Prisma, PrismaClient } from '@prisma/client'; // Import PrismaClient for transaction typing, OrderStatus
import { Decimal } from '@prisma/client/runtime/library'; // Import Decimal
import { prisma } from "@/lib/db"; // Import prisma client directly
import { generateFinvoiceXml, type SellerSettings } from "@/lib/services/finvoice.service"; // Import the service AND SellerSettings type
import { createAppCaller } from "@/lib/api/root"; // Import createAppCaller
// Settings type will be inferred from the settings router output or can be explicitly imported if needed.
// import type { Settings } from "@prisma/client"; 

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
          payments: true, // Added payments here
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
      // TODO: Add companyId from ctx when multi-tenancy is fully implemented for invoice creation
      // const companyId = ctx.companyId;

      let subTotal = new Decimal(0); // Represents NET total
      let totalVatAmountValue = new Decimal(0);

      // Fetch all inventory items to get their cost prices
      const inventoryItemIds = items.map(item => item.itemId);
      const inventoryItemsFromDb = await prisma.inventoryItem.findMany({
        where: {
          id: { in: inventoryItemIds },
          // TODO: companyId: companyId, // Filter by company when available
        },
        select: { id: true, costPrice: true, itemType: true }, // Select costPrice and itemType
      });
      const inventoryItemMap = new Map(inventoryItemsFromDb.map(item => [item.id, item]));

      // Prepare line items and calculate totals
      const invoiceItemsToCreate = await Promise.all(items.map(async (item) => {
        const unitPrice = new Decimal(item.unitPrice); // Assuming item.unitPrice is NET
        const quantity = new Decimal(item.quantity);
        let lineNetUnitPrice = unitPrice; // This is the price after line item discount

        // Apply discount to determine actual selling price per unit for profit calculation
        if (item.discountPercent != null && item.discountPercent > 0) {
          const discountMultiplier = new Decimal(1).minus(new Decimal(item.discountPercent).div(100));
          lineNetUnitPrice = unitPrice.times(discountMultiplier);
        } else if (item.discountAmount != null && item.discountAmount > 0) {
          // discountAmount is for the whole line, so convert to per-unit discount for lineNetUnitPrice
          if (quantity.greaterThan(0)) {
            const perUnitDiscount = new Decimal(item.discountAmount).div(quantity);
            lineNetUnitPrice = unitPrice.sub(perUnitDiscount).greaterThanOrEqualTo(0) ? unitPrice.sub(perUnitDiscount) : new Decimal(0);
          }
        }
        
        const lineTotal = lineNetUnitPrice.times(quantity); // NET line total after discount
        subTotal = subTotal.plus(lineTotal);

        let itemVat = new Decimal(0);
        if (!vatReverseCharge) {
          itemVat = lineTotal.times(new Decimal(item.vatRatePercent).div(100));
          totalVatAmountValue = totalVatAmountValue.plus(itemVat);
        }

        const inventoryItemDetails = inventoryItemMap.get(item.itemId);
        if (!inventoryItemDetails) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Inventory item with ID ${item.itemId} not found.` });
        }

        const calculatedUnitCost = inventoryItemDetails.costPrice ?? new Decimal(0); // Fallback to 0 if costPrice is null
        const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
        const calculatedLineProfit = calculatedUnitProfit.times(quantity);

        return {
          inventoryItemId: item.itemId,
          description: item.description,
          quantity,
          unitPrice, // Original NET unit price before discount (as per schema expectation for unitPrice field)
          vatRatePercent: new Decimal(item.vatRatePercent),
          discountAmount: item.discountAmount != null ? new Decimal(item.discountAmount) : null,
          discountPercent: item.discountPercent != null ? new Decimal(item.discountPercent) : null,
          calculatedUnitCost,
          calculatedUnitProfit,
          calculatedLineProfit,
        };
      }));

      if (vatReverseCharge) {
        totalVatAmountValue = new Decimal(0); // Explicitly zero out VAT if reverse charge
      }

      // Sequential Invoice Number Logic (existing code, ensure it's complete in actual file)
      // ... (invoice number logic as previously seen) ...
      let nextInvoiceNumber = 'INV-00001'; // Placeholder if logic not fully visible
      const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { createdAt: 'desc' }, 
        // where: { companyId }, // TODO: Filter by companyId for sequential numbering per company
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
            // Fallback or throw error if number generation is critical
        }
      }
      // End of invoice number logic section

      const dataForInvoiceCreate: Prisma.InvoiceCreateInput = {
        customer: { connect: { id: customerId } },
            invoiceNumber: nextInvoiceNumber,
            invoiceDate,
            dueDate,
        status: InvoiceStatus.draft,
            notes,
        vatReverseCharge,
        totalAmount: subTotal, // NET amount
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

      // If created from an order, update order status
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

        // Fetch all inventory items related to the order items to get their cost prices
        const orderInventoryItemIds = order.items.map(item => item.inventoryItemId);
        const inventoryItemsFromDb = await tx.inventoryItem.findMany({
          where: {
            id: { in: orderInventoryItemIds },
            // TODO: companyId: ctx.companyId, // Filter by company when available
          },
          select: { id: true, costPrice: true },
        });
        const inventoryItemCostMap = new Map(inventoryItemsFromDb.map(item => [item.id, item.costPrice]));

        const invoiceItemsData = order.items.map(orderItem => {
          if (!orderItem.inventoryItem) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Inventory item details missing for order item ${orderItem.id}` });
          }
          const unitPrice = new Prisma.Decimal(orderItem.unitPrice); // Original NET unit price from order
          const quantity = new Prisma.Decimal(orderItem.quantity);
          let lineNetUnitPrice = unitPrice; // This is the price after line item discount

          // Apply discount from order item if present
          const discountPercentageValue = orderItem.discountPercentage;
          const discountAmountValue = orderItem.discountAmount;

          if (discountPercentageValue != null && new Prisma.Decimal(discountPercentageValue).gt(0)) {
            const discountMultiplier = new Prisma.Decimal(1).minus(new Prisma.Decimal(discountPercentageValue).div(100));
            lineNetUnitPrice = lineNetUnitPrice.times(discountMultiplier);
          } else if (discountAmountValue != null && new Prisma.Decimal(discountAmountValue).gt(0)) {
            // discountAmount is for the whole line, so convert to per-unit discount
            if (quantity.greaterThan(0)){
                const perUnitDiscount = new Prisma.Decimal(discountAmountValue).div(quantity);
                lineNetUnitPrice = lineNetUnitPrice.sub(perUnitDiscount).greaterThanOrEqualTo(0) ? lineNetUnitPrice.sub(perUnitDiscount) : new Prisma.Decimal(0);
            }
          }

          const lineTotal = lineNetUnitPrice.times(quantity); // NET line total after discount
          subTotal = subTotal.plus(lineTotal);
          
          // Using a placeholder default VAT rate as InventoryItem.defaultVatRatePercent is not yet implemented
          const vatRate = new Prisma.Decimal(25.5); 

          if (!vatReverseCharge) {
            const itemVat = lineTotal.times(vatRate.div(100));
            totalVatAmountValue = totalVatAmountValue.plus(itemVat);
          }

          const calculatedUnitCost = inventoryItemCostMap.get(orderItem.inventoryItemId) ?? new Prisma.Decimal(0);
          const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
          const calculatedLineProfit = calculatedUnitProfit.times(quantity);

          return {
            inventoryItemId: orderItem.inventoryItemId,
            description: orderItem.inventoryItem.name, 
            quantity: orderItem.quantity, 
            unitPrice: orderItem.unitPrice, // Store original NET unit price from order
            vatRatePercent: vatRate, 
            discountAmount: orderItem.discountAmount, 
            discountPercent: orderItem.discountPercentage, 
            calculatedUnitCost,
            calculatedUnitProfit,
            calculatedLineProfit,
          };
        });
        
        if (vatReverseCharge) {
          totalVatAmountValue = new Prisma.Decimal(0);
        }
        // const finalTotalAmount = subTotal.plus(totalVatAmountValue); // Commented out, not needed

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

        const invoiceCreateDataFromOrder: Prisma.InvoiceCreateInput = {
            invoiceNumber: nextInvoiceNumber,
          customer: { connect: { id: order.customerId } },
            invoiceDate: finalInvoiceDate,
            dueDate: finalDueDate,
            notes: notes ?? order.notes, 
          order: { connect: { id: order.id } },
            status: InvoiceStatus.draft, 
          totalAmount: subTotal, // NET amount
            totalVatAmount: totalVatAmountValue,
            vatReverseCharge: vatReverseCharge,
          user: { connect: { id: userId } },
            items: {
            create: invoiceItemsData.map(item => ({
              inventoryItemId: item.inventoryItemId,
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              vatRatePercent: new Prisma.Decimal(item.vatRatePercent),
              discountAmount: item.discountAmount ? new Prisma.Decimal(item.discountAmount) : null,
              discountPercent: item.discountPercent ? new Prisma.Decimal(item.discountPercent) : null,
              calculatedUnitCost: item.calculatedUnitCost,
              calculatedUnitProfit: item.calculatedUnitProfit,
              calculatedLineProfit: item.calculatedLineProfit,
            })),
          },
        };

        const newInvoice = await tx.invoice.create({
          data: invoiceCreateDataFromOrder,
        });

        // Update Order status to INVOICED
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.INVOICED },
        });

        return newInvoice;
      });
    }),

  // Procedure to generate Finvoice XML for an invoice
  generateFinvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { invoiceId } = input;

      // 1. Fetch the invoice data with customer and items
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: { include: { addresses: true } },
          items: { include: { inventoryItem: true } },
          order: true,
          payments: true, // Added payments here
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      }

      // 2. Fetch company settings by creating a caller for the settings router
      const caller = createAppCaller(ctx); // Create a caller instance with the current context
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
      
      // Map Prisma Invoice to the Invoice type expected by finvoice.service.ts
      const mappedInvoiceForXml: import('@/lib/types/invoice.types').Invoice = {
        id: invoice.id as import('@/lib/types/branded').UUID,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status as import('@/lib/types/invoice.types').InvoiceStatus, // Prisma enum is compatible
        totalAmount: invoice.totalAmount as unknown as import('@/lib/types/branded').Decimal,
        totalVatAmount: invoice.totalVatAmount as unknown as import('@/lib/types/branded').Decimal,
        vatReverseCharge: invoice.vatReverseCharge,
        notes: invoice.notes ?? undefined,
        paymentDate: invoice.payments?.[0]?.paymentDate ?? undefined, // Assuming latest payment if any
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
          addresses: invoice.customer.addresses.map(addr => ({
            id: addr.id as import('@/lib/types/branded').UUID,
            type: addr.type as import('@/lib/types/customer.types').AddressType, // Prisma enum is compatible
            streetAddress: addr.streetAddress,
            city: addr.city,
            postalCode: addr.postalCode,
            countryCode: addr.countryCode,
          })),
        },
        items: invoice.items.map(item => ({
          id: item.id as import('@/lib/types/branded').UUID,
          invoiceId: item.invoiceId as import('@/lib/types/branded').UUID,
          description: item.description ?? item.inventoryItem?.name ?? 'N/A',
          quantity: item.quantity as unknown as import('@/lib/types/branded').Decimal,
          unitPrice: item.unitPrice as unknown as import('@/lib/types/branded').Decimal,
          vatRatePercent: item.vatRatePercent as unknown as import('@/lib/types/branded').Decimal,
          discountAmount: item.discountAmount as unknown as import('@/lib/types/branded').Decimal ?? null,
          discountPercent: item.discountPercentage as unknown as import('@/lib/types/branded').Decimal ?? null,
          // inventoryItemId: item.inventoryItemId as import('@/lib/types/branded').UUID, // If needed by service
        })),
        orderId: invoice.orderId as import('@/lib/types/branded').UUID ?? undefined,
        order: invoice.order ? {
          id: invoice.order.id as import('@/lib/types/branded').UUID,
          orderNumber: invoice.order.orderNumber,
          createdAt: invoice.order.orderDate, // Mapped orderDate to createdAt
          customerId: invoice.order.customerId as import('@/lib/types/branded').UUID,
          status: invoice.order.status as import('@/lib/types/order.types').OrderStatus,
          totalAmount: invoice.order.totalAmount as unknown as import('@/lib/types/branded').Decimal, 
          notes: invoice.order.notes ?? undefined,
          updatedAt: invoice.order.updatedAt,
          // Provide minimal valid customer and items to satisfy Order type
          customer: { 
            id: invoice.order.customerId as import('@/lib/types/branded').UUID, 
            name: invoice.customer.name, // Use invoice customer's name as a placeholder
            // other Customer fields can be minimal or undefined if allowed by Customer type in order.types.ts
            addresses: [], // Empty array for addresses
          } as import('@/lib/types/customer.types').Customer, // Cast to Customer type
          items: [], // Empty array for items
        } : undefined,
        // credit note fields can be mapped if/when credit notes are implemented
      };

      // Map companySettings (Prisma Settings type) to SellerSettings type (from finvoice.service.ts).
      // Uses settingsSchema for field names from DB (e.g., companySettings.vatId corresponds to SellerSettings.vatId).
      const mappedSettingsForXml: SellerSettings = {
        companyName: companySettings.companyName ?? "Missing Company Name",
        vatId: companySettings.vatId ?? "Missing VAT ID", // from settings.schema.ts
        domicile: companySettings.domicile ?? "Missing Domicile", // from settings.schema.ts
        streetAddress: companySettings.streetAddress ?? "Missing Street Address", // from settings.schema.ts
        postalCode: companySettings.postalCode ?? "Missing Postal Code", // from settings.schema.ts
        city: companySettings.city ?? "Missing City", // from settings.schema.ts
        countryCode: companySettings.countryCode ?? "FI", // from settings.schema.ts
        countryName: companySettings.countryName ?? "Finland", // from settings.schema.ts
        bankAccountIBAN: companySettings.bankAccountIBAN ?? "Missing IBAN", // from settings.schema.ts
        bankAccountBIC: companySettings.bankAccountBIC ?? "Missing BIC", // from settings.schema.ts

        // Optional fields in SellerSettings, map from companySettings (from settings.schema.ts)
        website: companySettings.website || undefined,
        sellerIdentifier: companySettings.sellerIdentifier || undefined,
        sellerIntermediatorAddress: companySettings.sellerIntermediatorAddress || undefined,
        bankName: companySettings.bankName || undefined,
      };

      // 3. Generate Finvoice XML
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

  // Update an existing invoice
  update: protectedProcedure
    .input(UpdateInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, customerId, invoiceDate, dueDate, notes, items: inputItems, orderId, vatReverseCharge, status } = input;
      const userId = ctx.session.user.id; // Needed if you update who last modified, or for new items if not company-scoped

      // Fetch the existing invoice to compare items and get current vatReverseCharge if not in input
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      const dataToUpdate: Prisma.InvoiceUpdateInput = {};
      // Initialize inventoryItemCostMap here to be accessible in both blocks
      let inventoryItemCostMap = new Map<string, Decimal | null>();

      if (customerId !== undefined) dataToUpdate.customer = { connect: { id: customerId } };
      if (invoiceDate !== undefined) dataToUpdate.invoiceDate = invoiceDate;
      if (dueDate !== undefined) dataToUpdate.dueDate = dueDate;
      if (notes !== undefined) dataToUpdate.notes = notes;
      if (orderId !== undefined) dataToUpdate.order = orderId ? { connect: { id: orderId } } : { disconnect: true };
      if (status !== undefined) dataToUpdate.status = status;
      
      const currentVatReverseCharge = vatReverseCharge !== undefined ? vatReverseCharge : existingInvoice.vatReverseCharge;
      if (vatReverseCharge !== undefined) dataToUpdate.vatReverseCharge = vatReverseCharge; 

      // If items or vatReverseCharge are being updated, totals need recalculation.
      if (inputItems || vatReverseCharge !== undefined) {
        let newSubTotal = new Decimal(0);
        let newTotalVatAmount = new Decimal(0);

        // Fetch cost prices for all relevant inventory items if items are changing
        // inventoryItemCostMap is already declared in the higher scope
        if (inputItems) {
          const inventoryItemIds = inputItems.map(item => item.itemId);
          const inventoryItemsFromDb = await prisma.inventoryItem.findMany({
            where: { id: { in: inventoryItemIds } /* TODO: Add companyId filter */ },
            select: { id: true, costPrice: true },
          });
          // Populate the map if inputItems are present
          inventoryItemCostMap = new Map(inventoryItemsFromDb.map(item => [item.id, item.costPrice]));
        }
        
        const itemsForCalcInput = inputItems ? inputItems : existingInvoice.items.map(item => ({
          id: item.id,
          itemId: item.inventoryItemId,
          description: item.description ?? undefined,
          unitPrice: item.unitPrice.toNumber(),
          quantity: item.quantity.toNumber(),
          vatRatePercent: item.vatRatePercent.toNumber(),
          discountAmount: item.discountAmount?.toNumber(),
          discountPercent: item.discountPercentage?.toNumber(),
        }));

        // This loop is for calculating totals (newSubTotal, newTotalVatAmount)
        // Profitability will be calculated when preparing the actual create/update operations for items later.
        for (const item of itemsForCalcInput) {
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
          newSubTotal = newSubTotal.plus(lineTotal);

          if (!currentVatReverseCharge) {
            const itemVat = lineTotal.times(new Decimal(item.vatRatePercent).div(100));
            newTotalVatAmount = newTotalVatAmount.plus(itemVat);
          }
        }
        
        if (currentVatReverseCharge) {
            newTotalVatAmount = new Decimal(0);
        }
        dataToUpdate.totalAmount = newSubTotal;
        dataToUpdate.totalVatAmount = newTotalVatAmount;
      }

      if (inputItems) {
        // If we didn't fetch costs earlier (e.g. only vatReverseCharge changed), fetch them now.
        if (inventoryItemCostMap.size === 0) {
            const inventoryItemIds = inputItems.map(item => item.itemId);
            const inventoryItemsFromDb = await prisma.inventoryItem.findMany({
                where: { id: { in: inventoryItemIds } /* TODO: Add companyId filter */ },
                select: { id: true, costPrice: true },
            });
            inventoryItemCostMap = new Map(inventoryItemsFromDb.map(item => [item.id, item.costPrice]));
        }

        const itemIdsFromInput = inputItems.map(item => item.id).filter(id => id !== undefined) as string[];
        const itemsToCreate = inputItems.filter(item => !item.id);
        const itemsToUpdate = inputItems.filter(item => item.id);
        const itemsToDelete = existingInvoice.items.filter(existingItem => !itemIdsFromInput.includes(existingItem.id));

        dataToUpdate.items = {
          create: itemsToCreate.map(item => {
            const unitPrice = new Decimal(item.unitPrice);
            const quantity = new Decimal(item.quantity);
            let lineNetUnitPrice = unitPrice;
            if (item.discountPercent != null && item.discountPercent > 0) {
              lineNetUnitPrice = unitPrice.times(new Decimal(1).minus(new Decimal(item.discountPercent).div(100)));
            } else if (item.discountAmount != null && item.discountAmount > 0 && quantity.greaterThan(0)) {
              lineNetUnitPrice = unitPrice.sub(new Decimal(item.discountAmount).div(quantity)).clamp(0, Infinity);
            }
            const calculatedUnitCost = inventoryItemCostMap.get(item.itemId) ?? new Decimal(0);
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
          }),
          updateMany: itemsToUpdate.map(item => {
            const unitPrice = new Decimal(item.unitPrice);
            const quantity = new Decimal(item.quantity);
            let lineNetUnitPrice = unitPrice;
            if (item.discountPercent != null && item.discountPercent > 0) {
              lineNetUnitPrice = unitPrice.times(new Decimal(1).minus(new Decimal(item.discountPercent).div(100)));
            } else if (item.discountAmount != null && item.discountAmount > 0 && quantity.greaterThan(0)) {
              lineNetUnitPrice = unitPrice.sub(new Decimal(item.discountAmount).div(quantity)).clamp(0, Infinity);
            }
            const calculatedUnitCost = inventoryItemCostMap.get(item.itemId) ?? new Decimal(0);
            const calculatedUnitProfit = lineNetUnitPrice.minus(calculatedUnitCost);
            const calculatedLineProfit = calculatedUnitProfit.times(quantity);
            return {
              where: { id: item.id! },
              data: {
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
              },
            };
          }),
          deleteMany: itemsToDelete.map(item => ({ id: item.id })),
        };
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: dataToUpdate,
        include: {
          items: true,
          customer: true,
        },
      });

      return updatedInvoice;
    }),

  // TODO: Add delete procedure
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Ensure related items are deleted first if cascade delete is not set up properly for InvoiceItems
      // await prisma.invoiceItem.deleteMany({ where: { invoiceId: input.id } }); 
      // This is usually handled by `onDelete: Cascade` in Prisma schema for the relation.
      // Assuming InvoiceItem.invoice relation has onDelete: Cascade or similar handling.
      
      await prisma.invoice.delete({ where: { id: input.id } });
      return { success: true };
    }),

}); 