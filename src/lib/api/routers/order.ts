import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/lib/api/trpc";
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
  OrderItemInput,
  UpdateOrderInput,
  listProductionViewInputSchema
} from "@/lib/schemas/order.schema";
import { OrderStatus, OrderType, Prisma, TransactionType, InventoryTransaction, MaterialType } from "@prisma/client";

// Helper to define the include structure for OrderDetail consistently
const orderDetailIncludeArgs = {
  customer: true,
  items: {
    include: {
      inventoryItem: true,
    },
  },
} satisfies Prisma.OrderInclude;

// Type for the order when fetched with details for OrderDetail component
export type OrderWithDetailsForRouter = Prisma.OrderGetPayload<{
  include: typeof orderDetailIncludeArgs;
}>;

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
const generateOrderNumber = async (tx: Prisma.TransactionClient) => {
  const lastOrder = await tx.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  let nextNumber = 1;
  if (lastOrder && lastOrder.orderNumber) {
    const match = lastOrder.orderNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }
  return `ORD-${String(nextNumber).padStart(5, '0')}`;
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
              billOfMaterial: {
                include: {
                  items: {
                    include: {
                      rawMaterialItem: true,
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
    // Should not happen if called correctly, but good to check
    console.error(`Order not found for stock deduction: ${orderId}`);
    return;
  }

  const transactionsToCreate: Prisma.InventoryTransactionCreateManyInput[] = [];

  for (const orderItem of order.items) {
    const orderedQuantity = new Prisma.Decimal(orderItem.quantity);

    // Check if the item is manufactured and has a Bill of Material
    if (
      orderItem.inventoryItem.materialType === MaterialType.manufactured &&
      orderItem.inventoryItem.billOfMaterial &&
      orderItem.inventoryItem.billOfMaterial.items.length > 0
    ) {
      // Deduct BOM components
      for (const bomItem of orderItem.inventoryItem.billOfMaterial.items) {
        const requiredRawMaterialQuantity = new Prisma.Decimal(bomItem.quantity).mul(orderedQuantity);
        transactionsToCreate.push({
          itemId: bomItem.rawMaterialItemId,
          quantity: requiredRawMaterialQuantity.negated(),
          type: TransactionType.sale, // Or a specific "production_consumption" type
          reference: `Production for Order ${order.orderNumber} (Item: ${orderItem.inventoryItem.name})`,
          note: `Raw material ${bomItem.rawMaterialItem.name} consumed for ${orderItem.inventoryItem.name}`,
        });
      }
    } else {
      // Deduct the item itself (raw material or manufactured item without BOM processing)
      transactionsToCreate.push({
        itemId: orderItem.inventoryItemId,
        quantity: orderedQuantity.negated(),
        type: TransactionType.sale, // Or a specific "production_consumption" type
        reference: `Production for Order ${order.orderNumber}`,
        note: `Item ${orderItem.inventoryItem.name} consumed/allocated for production`,
      });
    }
  }

  if (transactionsToCreate.length > 0) {
    await tx.inventoryTransaction.createMany({ data: transactionsToCreate });
    // TODO: Implement alert generation for negative stock if any transaction results in it.
    // This could involve checking stock levels after these transactions for the affected items.
  }
}

// Define the payload for listProductionView
const productionOrderPayload = {
  select: {
    id: true,
    orderNumber: true,
    orderDate: true,
    // deliveryDate: true, // Temporarily commented out due to linter issues; PRD shows it on Kanban card.
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
            materialType: true,
            billOfMaterial: {
              include: {
                items: {
                  include: {
                    rawMaterialItem: { select: { id: true, name: true, sku: true } },
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
  list: protectedProcedure
    .input(listOrdersSchema)
    .query(async ({ input }) => {
      const { limit: limitInput, cursor, customerId, status, orderType } = input;
      const limit = limitInput ?? 10;

      const whereClause: Prisma.OrderWhereInput = {
        customerId: customerId, 
        status: status === null ? undefined : status, 
        orderType: orderType === null ? undefined : orderType,
      };

      const items = await prisma.order.findMany({
        take: limit + 1, 
        cursor: cursor ? { id: cursor } : undefined,
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        include: {
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

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }): Promise<OrderWithDetailsForRouter | null> => {
      const order = await prisma.order.findUnique({
        where: { id: input.id },
        include: orderDetailIncludeArgs,
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found.",
        });
      }
      return order as OrderWithDetailsForRouter;
    }),

  listProductionView: protectedProcedure
    .input(listProductionViewInputSchema) 
    .query(async ({ ctx }) => {
      const orders = await prisma.order.findMany({
        where: {
          orderType: OrderType.work_order,
          status: {
            in: [
              OrderStatus.confirmed,
              OrderStatus.in_production,
              OrderStatus.shipped,
            ],
          },
          // companyId: ctx.companyId, // Enable for multi-tenancy
        },
        ...productionOrderPayload // Apply the defined select/include structure
      });

      if (!orders) {
        return [];
      }

      // Map the result, ensuring totalQuantity is added
      return orders.map((order: ProductionOrderFromFindMany) => ({
        ...order,
        // Ensure all fields required by KanbanOrder are present, especially deliveryDate
        // deliveryDate: order.deliveryDate, // Temporarily commented out
        totalQuantity: order.items.reduce((sum, item) => 
          sum.add(new Prisma.Decimal(item.quantity)), new Prisma.Decimal(0)),
      }));
    }),

  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ input, ctx }) => {
      const { customerId, items, notes, status, orderType, deliveryDate } = input;
      const userId = ctx.session.user.id;

      if (items.some((item) => item.unitPrice === undefined || item.unitPrice === null)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unit price must be provided for all order items.',
        });
      }

      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const orderNumber = await generateOrderNumber(tx);
        const totalAmount = calculateOrderTotal(items);

        const mappedItemsForCreation = items.map((item) => ({
          inventoryItemId: item.itemId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice!),
          discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : undefined,
          discountPercentage: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : undefined,
        }));

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            customerId,
            userId,
            status: status ?? OrderStatus.draft,
            orderType: orderType ?? OrderType.work_order,
            // deliveryDate, // Temporarily commented out
            notes,
            totalAmount,
            items: {
              create: mappedItemsForCreation,
            },
          },
          include: { items: true, customer: true },
        });

        if (newOrder.status === OrderStatus.confirmed) {
          await checkAndAllocateStock(newOrder.id, tx);
        }

        return newOrder;
      });
    }),

  update: protectedProcedure
    .input(updateOrderSchema) 
    .mutation(async ({ input, ctx }) => {
      const { id, items: inputItems, ...restOfInput } = input;
      const userId = ctx.session.user.id; 

      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingOrder = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existingOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
        }

        let totalAmount = existingOrder.totalAmount;
        if (inputItems) {
          if (inputItems.some((item) => item.unitPrice === undefined || item.unitPrice === null)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unit price must be provided for all order items if items are being updated.',
            });
          }
          totalAmount = calculateOrderTotal(inputItems);
        }

        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            ...restOfInput,
            totalAmount, 
            items: inputItems
              ? {
                  deleteMany: { orderId: id }, 
                  create: inputItems.map((item) => ({
                    inventoryItemId: item.itemId,
                    quantity: new Prisma.Decimal(item.quantity),
                    unitPrice: new Prisma.Decimal(item.unitPrice!),
                    discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : undefined,
                    discountPercentage: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : undefined,
                  })),
                }
              : undefined,
          },
          include: { items: true, customer: true },
        });
        
        if (updatedOrder.status === OrderStatus.confirmed) {
          await tx.inventoryTransaction.deleteMany({
            where: {
              reference: `Order ${id}`,
              type: TransactionType.sale 
            }
          });
          await checkAndAllocateStock(updatedOrder.id, tx);
        }

        return updatedOrder;
      });
    }),

  updateStatus: protectedProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ input }) => {
      const { id, status: newStatus } = input;

      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const order = await tx.order.findUnique({
          where: { id },
        });

        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
        }

        const currentStatus = order.status;

        const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
            [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled, OrderStatus.quote_sent],
            [OrderStatus.quote_sent]: [OrderStatus.quote_accepted, OrderStatus.quote_rejected, OrderStatus.cancelled],
            [OrderStatus.quote_accepted]: [OrderStatus.confirmed, OrderStatus.cancelled],
            [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled, OrderStatus.shipped ],
            [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled], 
            [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.cancelled], 
        };

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
             throw new TRPCError({
                 code: 'BAD_REQUEST',
                 message: `Cannot transition order from ${currentStatus} to ${newStatus}. Valid transitions: ${validTransitions[currentStatus]?.join(', ') || 'None'}`
             });
        }

        // Original stock allocation for 'confirmed' status (for non-production items or finished goods)
        if (currentStatus !== OrderStatus.confirmed && newStatus === OrderStatus.confirmed) {
           // We might want to refine checkAndAllocateStock to NOT deduct items that will have BOMs deducted later
           // For now, it allocates the main items. If an item is manufactured, this might allocate the finished product.
           await checkAndAllocateStock(id, tx);
        }
        
        // New: Deduct stock for production when status changes to 'in_production'
        if (newStatus === OrderStatus.in_production && currentStatus !== OrderStatus.in_production) {
          if (order.orderType === OrderType.work_order) { // Only for work orders
            await handleProductionStockDeduction(id, tx);
          }
        }
        // TODO: Handle stock de-allocation if order is cancelled after confirmation or after going into production.

        const updatedOrder = await tx.order.update({
          where: { id },
          data: { status: newStatus },
        });

        return updatedOrder;
      });
    }),
}); 