import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import {
  createTRPCRouter,
  protectedProcedure,
  companyProtectedProcedure,
} from "@/lib/api/trpc";
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
  OrderItemInput,
  listProductionViewInputSchema,
  deleteManyOrdersSchema,
  sendManyOrdersToProductionSchema
} from "@/lib/schemas/order.schema";
import { OrderStatus, OrderType, Prisma, TransactionType, InventoryTransaction, ItemType } from "@prisma/client";

// Helper to define the include structure for OrderDetail consistently
const orderDetailIncludeArgs = {
  customer: {
    include: {
      addresses: true,
    },
  },
  items: {
    include: {
      inventoryItem: true,
    },
  },
  originalQuotation: {
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
    },
  },
  derivedWorkOrders: {
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      status: true,
    },
  },
} satisfies Prisma.OrderInclude;

// Type for the order when fetched with details for OrderDetail component
export type OrderWithDetailsForRouter = Prisma.OrderGetPayload<{
  include: typeof orderDetailIncludeArgs;
}>;

// NEW HELPER FUNCTION to process Decimals in an OrderWithDetailsForRouter object
const processOrderDecimals = (order: OrderWithDetailsForRouter) => {
  return {
    ...order,
    totalAmount: order.totalAmount?.toString() ?? null,
    items: order.items.map(item => ({
      ...item,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toString(),
      discountAmount: item.discountAmount?.toString() ?? null,
      inventoryItem: {
        ...item.inventoryItem,
        costPrice: item.inventoryItem.costPrice.toString(),
        salesPrice: item.inventoryItem.salesPrice.toString(),
        minimumStockLevel: item.inventoryItem.minimumStockLevel.toString(),
        reorderLevel: item.inventoryItem.reorderLevel?.toString() ?? null,
      }
    }))
  };
};

// Helper function to calculate order total including discounts
const calculateOrderTotal = (items: OrderItemInput[]): Prisma.Decimal => {
  return items.reduce((total: Prisma.Decimal, item: OrderItemInput) => {
    const price = new Prisma.Decimal(item.unitPrice ?? 0); 
    const quantity = new Prisma.Decimal(item.quantity);
    let lineTotal = price.mul(quantity);

    if (item.discountPercent != null && item.discountPercent > 0) {
      const discountMultiplier = new Prisma.Decimal(1).minus(
        new Prisma.Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.mul(discountMultiplier);
    } else if (item.discountAmount != null && item.discountAmount > 0) {
      const discount = new Prisma.Decimal(item.discountAmount);
      lineTotal = lineTotal.sub(discount).greaterThanOrEqualTo(0) ? lineTotal.sub(discount) : new Prisma.Decimal(0);
    }
    return total.add(lineTotal);
  }, new Prisma.Decimal(0));
};

// Helper to generate unique order number (example)
const generateOrderNumber = async (tx: Prisma.TransactionClient, orderType?: OrderType, originalQuotationId?: string) => {
  if (orderType === OrderType.work_order && originalQuotationId) {
    // For work orders created from quotations, use the quotation number as base
    const quotation = await tx.order.findUnique({
      where: { id: originalQuotationId },
      select: { orderNumber: true }
    });
    
    if (quotation) {
      // Find existing work orders created from this quotation
      const existingWorkOrders = await tx.order.findMany({
        where: { 
          originalQuotationId: originalQuotationId,
          orderType: OrderType.work_order
        },
        select: { orderNumber: true },
        orderBy: { createdAt: 'asc' }
      });
      
      const baseNumber = quotation.orderNumber; // e.g., "ORD-00001"
      
      if (existingWorkOrders.length === 0) {
        return `${baseNumber}-WO`; // First work order: ORD-00001-WO
      } else {
        return `${baseNumber}-WO${existingWorkOrders.length + 1}`; // Subsequent: ORD-00001-WO2, ORD-00001-WO3
      }
    }
  }
  
  // Default numbering for quotations and standalone work orders with retry logic
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    try {
      // Get the highest order number with a more specific query
      const lastOrder = await tx.order.findFirst({
        where: {
          orderNumber: {
            startsWith: 'ORD-'
          }
        },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      
      let nextNumber = 1;
      if (lastOrder && lastOrder.orderNumber) {
        // Extract number from patterns like ORD-00001, ORD-00001-WO, etc.
        const match = lastOrder.orderNumber.match(/ORD-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Add some randomness to reduce collision probability
      const randomOffset = Math.floor(Math.random() * 10);
      nextNumber += randomOffset;
      
      const baseNumber = `ORD-${String(nextNumber).padStart(5, '0')}`;
      
      let candidateNumber: string;
      if (orderType === OrderType.work_order) {
        candidateNumber = `${baseNumber}-WO`; // Standalone work order: ORD-00001-WO
      } else {
        candidateNumber = baseNumber; // Quotation: ORD-00001
      }
      
      // Check if this number already exists
      const existingOrder = await tx.order.findUnique({
        where: { orderNumber: candidateNumber },
        select: { id: true }
      });
      
      if (!existingOrder) {
        return candidateNumber;
      }
      
      // If it exists, increment and try again
      attempts++;
      continue;
      
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate unique order number after multiple attempts'
        });
      }
      // Wait a bit before retrying to reduce collision probability
      await new Promise(resolve => setTimeout(resolve, 10 * attempts));
    }
  }
  
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to generate unique order number'
  });
};

// Helper function to check stock and potentially create transactions
async function checkAndAllocateStock(orderId: string, tx: Prisma.TransactionClient) {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId },
      include: { inventoryItem: true },
    });

    const stockIssues: { itemId: string; name: string; requested: number; available: number }[] = [];
    const transactionsToCreate: Prisma.InventoryTransactionCreateManyInput[] = [];

    for (const orderItem of orderItems) {
      const itemTransactions = await tx.inventoryTransaction.findMany({
        where: { itemId: orderItem.inventoryItemId },
      });
      const quantityOnHand = itemTransactions.reduce((total: Prisma.Decimal, transaction: InventoryTransaction) => {
          return total.add(transaction.quantity);
      }, new Prisma.Decimal(0));

      const requestedQuantity = new Prisma.Decimal(orderItem.quantity);

      if (quantityOnHand.lessThan(requestedQuantity)) {
        stockIssues.push({
          itemId: orderItem.inventoryItemId,
          name: orderItem.inventoryItem.name,
          requested: requestedQuantity.toNumber(),
          available: quantityOnHand.toNumber(),
        });
      } else {
         transactionsToCreate.push({
             itemId: orderItem.inventoryItemId,
             quantity: requestedQuantity.negated(),
             type: TransactionType.sale, 
             reference: `Order ${orderId}`,
             note: `Stock allocated for order ${orderId}`,
         });
      }
    }

    if (stockIssues.length > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Insufficient stock for items: ${stockIssues.map(i => `${i.name} (requested: ${i.requested}, available: ${i.available})`).join(', ')}`,
      });
    } else {
        if (transactionsToCreate.length > 0) {
            await tx.inventoryTransaction.createMany({ data: transactionsToCreate });
        }
    }
}

// New helper function for deducting stock for production (BOM components or direct items)
// This version allows negative stock and does not throw an error for insufficient stock.
async function handleProductionStockDeduction(orderId: string, tx: Prisma.TransactionClient) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          inventoryItem: {
            include: {
              bom: {
                include: {
                  items: {
                    include: {
                      componentItem: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    console.error(`Order not found for stock deduction: ${orderId}`);
    return;
  }

  const transactionsToCreate: Prisma.InventoryTransactionCreateManyInput[] = [];

  for (const orderItem of order.items) {
    const orderedQuantity = new Prisma.Decimal(orderItem.quantity);

    if (
      orderItem.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD &&
      orderItem.inventoryItem.bom &&
      orderItem.inventoryItem.bom.items.length > 0
    ) {
      for (const bomItem of orderItem.inventoryItem.bom.items) {
        if (!bomItem.componentItem) {
            console.warn(`Skipping BOM item ${bomItem.id} for order ${order.orderNumber} due to missing componentItem data.`);
            continue;
        }
        const requiredComponentQuantity = new Prisma.Decimal(bomItem.quantity).mul(orderedQuantity);
        transactionsToCreate.push({
          itemId: bomItem.componentItemId,
          quantity: requiredComponentQuantity.negated(),
          type: TransactionType.sale,
          reference: `Production for Order ${order.orderNumber} (Item: ${orderItem.inventoryItem.name})`,
          note: `Component ${bomItem.componentItem.name} consumed for ${orderItem.inventoryItem.name}`,
        });
      }
    } else {
      transactionsToCreate.push({
        itemId: orderItem.inventoryItemId,
        quantity: orderedQuantity.negated(),
        type: TransactionType.sale,
        reference: `Production for Order ${order.orderNumber}`,
        note: `Item ${orderItem.inventoryItem.name} consumed/allocated for production`,
      });
    }
  }

  if (transactionsToCreate.length > 0) {
    await tx.inventoryTransaction.createMany({ data: transactionsToCreate });
  }
}

// Define the payload for listProductionView
const productionOrderPayload = {
  select: {
    id: true,
    orderNumber: true,
    orderDate: true,
    deliveryDate: true,
    status: true,
    orderType: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    userId: true,
    customerId: true,
    // totalAmount: true, // Excluded pricing
    productionStep: true,
    customer: { select: { id: true, name: true } },
    user: { select: { id: true, name: true, firstName: true } },
    items: {
      orderBy: { inventoryItem: { name: 'asc' } },
      select: {
        id: true,
        quantity: true,
        // unitPrice: true, // Excluded pricing
        // discountAmount: true, // Excluded pricing
        // discountPercentage: true, // Excluded pricing
        inventoryItemId: true,
        inventoryItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            itemType: true,
            bom: {
              include: {
                items: {
                  include: {
                    componentItem: { select: { id: true, name: true, sku: true } },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
} satisfies { select: Prisma.OrderSelect }; // Ensure the structure matches what findMany expects

export type ProductionOrderFromFindMany = Prisma.OrderGetPayload<typeof productionOrderPayload>;

export const orderRouter = createTRPCRouter({
  list: companyProtectedProcedure
    .input(listOrdersSchema)
    .query(async ({ ctx, input }) => {
      const { limit: limitInput, cursor, customerId, status, orderType } = input;
      const limit = limitInput ?? 10;

      const where: Prisma.OrderWhereInput = {
        companyId: ctx.companyId,
      };

      if (customerId) {
        where.customerId = customerId;
      }
      if (status) {
        where.status = status;
      }
      if (orderType) {
        where.orderType = orderType;
      }

      const items = await prisma.order.findMany({
        take: limit + 1, 
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderType: true,
          createdAt: true,
          deliveryDate: true,
          totalAmount: true,
          customer: { select: { id: true, name: true } },
        }
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }
      return {
        items,
        nextCursor,
      };
    }),

  getById: companyProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await prisma.order.findUnique({
        where: { 
          id: input.id,
          companyId: ctx.companyId,
        },
        include: orderDetailIncludeArgs,
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      return processOrderDecimals(order);
    }),

  listProductionView: protectedProcedure
    .input(listProductionViewInputSchema)
    .query(async ({ input }) => {
      const orders = await prisma.order.findMany({
        where: {
          status: {
            in: [OrderStatus.in_production, OrderStatus.confirmed],
          },
          orderType: OrderType.work_order,
        },
        ...productionOrderPayload,
      });

      return orders;
    }),

  create: companyProtectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        const { items, ...orderData } = input;
        const orderTotal = calculateOrderTotal(items);
        const orderNumber = await generateOrderNumber(tx, orderData.orderType);
        const createdOrder = await tx.order.create({
          data: {
            ...orderData,
            orderNumber,
            userId: ctx.userId,
            companyId: ctx.companyId,
            totalAmount: orderTotal,
            items: {
              create: items.map((item) => ({
                inventoryItemId: item.inventoryItemId,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                discountPercentage: item.discountPercent,
                discountAmount: new Prisma.Decimal(item.discountAmount ?? 0),
              })),
            },
          },
        });
        return createdOrder;
      });
    }),

  update: companyProtectedProcedure
    .input(updateOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...orderData } = input;

      // Ensure that 'id' is a string if it's not undefined.
      const orderId = typeof id === 'string' ? id : '';

      return prisma.$transaction(async (tx) => {
        if (items) {
          const orderTotal = calculateOrderTotal(items);
          await tx.order.update({
            where: { id: orderId },
            data: {
              ...orderData,
              totalAmount: orderTotal,
            },
          });

          await tx.orderItem.deleteMany({ where: { orderId: orderId } });
          await tx.orderItem.createMany({
            data: items.map((item) => ({
              orderId: orderId,
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              discountPercentage: item.discountPercent,
              discountAmount: new Prisma.Decimal(item.discountAmount ?? 0),
            })),
          });
        } else {
          await tx.order.update({
            where: { id: orderId },
            data: { ...orderData },
          });
        }

        const updatedOrder = await tx.order.findUnique({
          where: { 
            id: orderId,
            companyId: ctx.companyId,
          },
          include: orderDetailIncludeArgs,
        });

        if (!updatedOrder) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not find order after update.",
          });
        }
        return updatedOrder;
      });
    }),

  updateStatus: companyProtectedProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, status } = input;

      const order = await prisma.order.findUnique({ 
        where: { 
          id,
          companyId: ctx.companyId,
        } 
      });
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }

      const updatedOrder = await prisma.order.update({
        where: { 
          id,
          companyId: ctx.companyId,
        },
        data: { status },
      });

      return updatedOrder;
    }),

  convertToWorkOrder: companyProtectedProcedure
    .input(z.object({ orderId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { orderId } = input;

      return await prisma.$transaction(async (tx) => {
        // Find the quotation order
        const quotation = await tx.order.findUnique({
          where: { 
            id: orderId,
            companyId: ctx.companyId,
          },
          include: {
            customer: {
              include: {
                addresses: true,
              },
            },
            items: {
              include: {
                inventoryItem: true,
              },
            },
          },
        });

        if (!quotation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' });
        }

        if (quotation.orderType !== OrderType.quotation) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only quotations can be converted to work orders' });
        }

        if (quotation.status !== OrderStatus.confirmed && quotation.status !== OrderStatus.draft) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quotation status must be draft or confirmed to create work order' });
        }

        // Generate new order number for the work order
        const newOrderNumber = await generateOrderNumber(tx, OrderType.work_order, quotation.id);

        // Ensure delivery date is properly handled - use null if undefined for consistency
        const deliveryDate = quotation.deliveryDate || null;

        // Create a new work order based on the quotation
        const newWorkOrder = await tx.order.create({
          data: {
            orderNumber: newOrderNumber,
            customerId: quotation.customerId,
            orderType: OrderType.work_order,
            status: OrderStatus.confirmed,
            orderDate: new Date(),
            deliveryDate: deliveryDate, // Explicitly use the normalized delivery date
            notes: quotation.notes,
            totalAmount: quotation.totalAmount,
            userId: ctx.userId,
            companyId: ctx.companyId,
            originalQuotationId: quotation.id, // Link back to the original quotation
            items: {
              create: quotation.items.map(item => ({
                inventoryItemId: item.inventoryItemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                discountPercentage: item.discountPercentage,
                vatRatePercent: item.vatRatePercent, // Ensure VAT rate is preserved
              })),
            },
          },
          include: orderDetailIncludeArgs,
        });

        return processOrderDecimals(newWorkOrder);
      });
    }),

  updateProductionStep: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        newStep: z.string(), // e.g., 'cutting', 'assembly', 'painting'
      })
    )
    .mutation(async ({ input }) => {
      const { orderId, newStep } = input;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      return await prisma.order.update({
        where: { id: orderId },
        data: { productionStep: newStep },
      });
    }),

  deleteMany: protectedProcedure
    .input(deleteManyOrdersSchema)
    .mutation(async ({ input }) => {
        const { ids } = input;
        
        const deletableOrders = await prisma.order.findMany({
            where: {
                id: { in: ids },
                status: OrderStatus.draft, // Only allow deleting drafts
            },
            select: { id: true }
        });

        const deletableIds = deletableOrders.map(o => o.id);
        
        const result = await prisma.order.deleteMany({
            where: {
                id: { in: deletableIds }
            }
        });
        
        return { count: result.count, deletedIds: deletableIds };
    }),

    sendManyToProduction: protectedProcedure
        .input(sendManyOrdersToProductionSchema)
        .mutation(async ({ input }) => {
            const { ids } = input;

            const ordersToUpdate = await prisma.order.findMany({
                where: {
                    id: { in: ids },
                    status: OrderStatus.confirmed, // Can only send confirmed orders
                },
                select: { id: true }
            });
            
            const validOrderIds = ordersToUpdate.map(o => o.id);

            const result = await prisma.order.updateMany({
                where: { id: { in: validOrderIds } },
                data: { status: OrderStatus.in_production }
            });
            
            return { count: result.count, updatedIds: validOrderIds };
        }),

  exportPDF: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Get the order with all details
      const order = await prisma.order.findUnique({
        where: { 
          id,
          companyId: ctx.companyId,
        },
        include: orderDetailIncludeArgs,
      });

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }

      // TODO: Implement actual PDF generation
      // For work orders: exclude prices, focus on BOMs and manufacturing details
      // For quotations: include all customer-oriented info including pricing
      
      // Placeholder implementation - return success for now
      return {
        success: true,
        message: `PDF export for ${order.orderType === OrderType.quotation ? 'quotation' : 'work order'} ${order.orderNumber} - Implementation pending`,
        orderType: order.orderType,
        orderNumber: order.orderNumber,
      };
    }),

  getFunnelStats: companyProtectedProcedure
    .query(async ({ ctx }) => {
      // Get all orders for the company
      const orders = await prisma.order.findMany({
        where: {
          companyId: ctx.companyId,
        },
        select: {
          status: true,
          totalAmount: true,
        },
      });

      const quotations = orders.filter(o => o.status === OrderStatus.draft);
      const pending = orders.filter(o => o.status === OrderStatus.confirmed);
      const production = orders.filter(o => o.status === OrderStatus.in_production);
      const completed = orders.filter(o => 
        o.status === OrderStatus.shipped || o.status === OrderStatus.delivered
      );

      const calculateStats = (orderList: typeof orders) => ({
        count: orderList.length,
        value: orderList.reduce((sum, order) => {
          const amount = order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0;
          return sum + amount;
        }, 0),
      });

      return {
        quotations: calculateStats(quotations),
        pending: calculateStats(pending),
        production: calculateStats(production),
        completed: calculateStats(completed),
      };
    }),
}); 