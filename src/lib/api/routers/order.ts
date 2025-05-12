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
  OrderItemInput, // Import the type
  UpdateOrderInput, // Explicitly import UpdateOrderInput
} from "@/lib/schemas/order.schema";
import { OrderStatus, OrderType, Prisma, TransactionType } from "@prisma/client";

// Helper function to calculate order total (consider moving to a service if complex)
const calculateOrderTotal = async (items: OrderItemInput[], tx: Prisma.TransactionClient) => {
  let total = new Prisma.Decimal(0);
  for (const item of items) {
    // Optionally fetch current price if pricePerUnit is not fixed at order time
    // const inventoryItem = await tx.inventoryItem.findUnique({ where: { id: item.itemId } });
    // if (!inventoryItem) throw new Error(`Item with ID ${item.itemId} not found`);
    // const price = item.pricePerUnit ?? inventoryItem.salesPrice; // Or use current price
    const price = new Prisma.Decimal(item.unitPrice);
    const quantity = new Prisma.Decimal(item.quantity);
    total = total.add(price.mul(quantity));
  }
  return total;
};

// Helper to generate unique order number (example)
const generateOrderNumber = async (tx: Prisma.TransactionClient) => {
  // Simple example: Find max number and increment
  // Replace with a more robust sequence/pattern later
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
  // Pad with leading zeros (e.g., ORD-00001)
  return `ORD-${String(nextNumber).padStart(5, '0')}`;
};

// Helper function to check stock and potentially create transactions
async function checkAndAllocateStock(orderId: string, tx: Prisma.TransactionClient) {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId },
      include: { item: true }, // Include inventory item details
    });

    const stockIssues: { itemId: string; name: string; requested: number; available: number }[] = [];
    const transactionsToCreate: Prisma.InventoryTransactionCreateManyInput[] = [];

    for (const orderItem of orderItems) {
      // Calculate current quantity on hand within the transaction
      const itemTransactions = await tx.inventoryTransaction.findMany({
        where: { itemId: orderItem.itemId },
      });
      const quantityOnHand = itemTransactions.reduce((total: Prisma.Decimal, transaction: { quantity: Prisma.Decimal }) => {
          return total.add(transaction.quantity); // quantity is Decimal, positive for purchase/adjust-in, negative for sale/adjust-out
      }, new Prisma.Decimal(0));

      const requestedQuantity = new Prisma.Decimal(orderItem.quantity);

      if (quantityOnHand.lessThan(requestedQuantity)) {
        stockIssues.push({
          itemId: orderItem.itemId,
          name: orderItem.item.name,
          requested: requestedQuantity.toNumber(),
          available: quantityOnHand.toNumber(),
        });
      } else {
         // Prepare stock allocation transaction (negative quantity for sale)
         transactionsToCreate.push({
             itemId: orderItem.itemId,
             quantity: requestedQuantity.negated(), // Decrement stock
             type: TransactionType.sale, // Assuming confirmation leads to sale transaction
             reference: `Order ${orderId}`, // Link transaction to order
             note: `Stock allocated for order ${orderId}`,
         });
      }
    }

    if (stockIssues.length > 0) {
      // Throw an error if any item has insufficient stock
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Insufficient stock for items: ${stockIssues.map(i => `${i.name} (requested: ${i.requested}, available: ${i.available})`).join(', ')}`,
      });
    } else {
        // If stock is sufficient for all items, create the allocation transactions
        if (transactionsToCreate.length > 0) {
            await tx.inventoryTransaction.createMany({ data: transactionsToCreate });
        }
    }
}

export const orderRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listOrdersSchema)
    .query(async ({ input }) => {
      console.log("[order.list] Raw input:", input); // Log raw input
      const { limit: limitInput, cursor, customerId, status } = input;
      const limit = limitInput ?? 10; // Default limit if nullish

      const whereClause: Prisma.OrderWhereInput = {
        customerId: customerId, // Prisma handles undefined correctly
        // Explicitly map null to undefined for Prisma, keep actual statuses
        status: status === null ? undefined : status, 
      };
      console.log("[order.list] Using whereClause:", whereClause); // Log constructed clause

      const items = await prisma.order.findMany({
        take: limit + 1, // Use the limit from input (already defaulted)
        cursor: cursor ? { id: cursor } : undefined,
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        include: {
            customer: { select: { id: true, name: true } }, // Include basic customer info
            // Avoid including items here for list performance, fetch in getById if needed
            // items: { include: { item: true } } 
        }
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      // Calculate total items count for each order separately if needed for display
      // Or adjust Prisma query if performance allows

      return {
        items,
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      const order = await prisma.order.findUnique({
        where: { id: input.id },
        include: {
          customer: true, // Include full customer details
          items: {
            include: {
              item: true, // Include full inventory item details for each order item
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found.",
        });
      }
      return order;
    }),

  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ input, ctx }) => {
      const { customerId, items, notes, status, orderType } = input;
      // Get userId from the authenticated context
      const userId = ctx.session.user.id;

      // Add explicit type for some parameter
      if (items.some((item: OrderItemInput) => item.unitPrice === undefined || item.unitPrice === null)) {
           throw new TRPCError({
               code: 'BAD_REQUEST',
               message: 'Unit price must be provided for all order items.',
           });
      }

      // Add explicit type for transaction client
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const orderNumber = await generateOrderNumber(tx);

        // Add explicit type for map parameter
        const mappedItems = items.map((item: OrderItemInput) => ({
          itemId: item.itemId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice!), // Already validated not null
        }));

        // Add explicit types for reduce parameters
        const totalAmount = mappedItems.reduce((sum: Prisma.Decimal, item: { quantity: Prisma.Decimal, unitPrice: Prisma.Decimal }) => {
            return sum.add(item.quantity.mul(item.unitPrice));
        }, new Prisma.Decimal(0));

        const order = await tx.order.create({
          data: {
            customerId,
            userId, // Add userId from the authenticated context
            orderNumber,
            status: status ?? OrderStatus.draft,
            orderType: orderType ?? OrderType.work_order,
            totalAmount,
            notes,
            items: {
              // Add explicit type for map parameter
              create: mappedItems.map((item: { itemId: string, quantity: Prisma.Decimal, unitPrice: Prisma.Decimal }) => ({
                itemId: item.itemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            },
          },
          include: { items: true },
        });

        // Allocate stock immediately if created in 'confirmed' state
        if (order.status === OrderStatus.confirmed) {
           await checkAndAllocateStock(order.id, tx);
        }

        return order;
      });
    }),

  // --- Add updateStatus Procedure ---
  updateStatus: protectedProcedure
    .input(updateOrderStatusSchema) // Use the specific schema { id: string, status: OrderStatus }
    .mutation(async ({ input }) => {
      const { id, status: newStatus } = input;

      // Add explicit type for transaction client
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Fetch the current order
        const order = await tx.order.findUnique({
          where: { id },
        });

        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
        }

        const currentStatus = order.status;

        // 2. Validate Status Transition (basic example, expand as needed)
        const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
            [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled],
            [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled],
            [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
            [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.cancelled], // Can orders be cancelled after shipping?
            // delivered and cancelled are terminal states
        };

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
             throw new TRPCError({
                 code: 'BAD_REQUEST',
                 message: `Cannot transition order from ${currentStatus} to ${newStatus}.`,
             });
        }

        // 3. Handle Stock Allocation/De-allocation
        if (currentStatus !== OrderStatus.confirmed && newStatus === OrderStatus.confirmed) {
          // Check and allocate stock when moving TO confirmed
           await checkAndAllocateStock(id, tx);
        }
        // TODO: Add logic for de-allocating stock if an order is cancelled *after* being confirmed?
        // This might involve creating reverse inventory transactions.

        // 4. Update the order status
        const updatedOrder = await tx.order.update({
          where: { id },
          data: { status: newStatus },
        });

        return updatedOrder;
      });
    }),

  update: protectedProcedure
    .input(updateOrderSchema)
    .mutation(async ({ input }: { input: UpdateOrderInput }) => {
      const { id, customerId, items, notes, status } = input;

      // Fetch existing order to compare items if necessary
      const existingOrder = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
      }

      // Prevent changing status via this endpoint; use updateStatus instead
      if (status && status !== existingOrder.status) {
           throw new TRPCError({
               code: 'BAD_REQUEST',
               message: 'Order status cannot be changed through this endpoint. Use updateStatus instead.',
           });
      }
      // Prevent changing customer via this endpoint? (Decide based on business logic)
       if (customerId && customerId !== existingOrder.customerId) {
           throw new TRPCError({
               code: 'BAD_REQUEST',
               message: 'Customer cannot be changed after order creation.',
           });
      }

      // Add explicit type for some parameter
      if (items && items.some((item: OrderItemInput) => item.unitPrice === undefined || item.unitPrice === null)) {
          throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unit price must be provided for all order items.',
          });
      }

      // Add explicit type for transaction client
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        let totalAmount = existingOrder.totalAmount;
        // Add explicit type for update data
        const updateData: Prisma.OrderUpdateInput = {
            notes: notes, // Update notes if provided
        };

        if (items) {
            // Add explicit type for map parameter
            const mappedItems = items.map((item: OrderItemInput) => ({
                id: item.id, // Include id for identifying existing items
                itemId: item.itemId,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice!), // Already validated
            }));

            // Add explicit types for reduce parameters
            totalAmount = mappedItems.reduce((sum: Prisma.Decimal, item: { quantity: Prisma.Decimal, unitPrice: Prisma.Decimal }) => {
                return sum.add(item.quantity.mul(item.unitPrice));
            }, new Prisma.Decimal(0));

            updateData.totalAmount = totalAmount;

            // Complex logic for updating items: delete removed, update existing, create new
            // Add explicit type for map parameter
            const existingItemIds = existingOrder.items.map((item: { id: string }) => item.id);
            // Add explicit type for map parameter
            const newItemIds = mappedItems.map((item: { id?: string }) => item.id).filter(Boolean);
            // Add explicit type for filter parameter
            const itemIdsToDelete = existingItemIds.filter((id: string) => !newItemIds.includes(id));

            // Perform deletions first
            if (itemIdsToDelete.length > 0) {
                await tx.orderItem.deleteMany({ where: { id: { in: itemIdsToDelete }, orderId: id } });
            }

            // Upsert items (update existing or create new)
            updateData.items = {
                // Add explicit type for map parameter
                upsert: mappedItems.map((item: { id?: string, itemId: string, quantity: Prisma.Decimal, unitPrice: Prisma.Decimal }) => ({
                    where: { id: item.id ?? '' }, // Use empty string if ID is null/undefined for create
                    create: { itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice },
                    update: { itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice },
                })),
            };
        }

        // Update the order
        const updatedOrder = await tx.order.update({
          where: { id },
          data: updateData,
          include: { items: true }, // Include items in the returned object
        });

        // Note: Stock allocation logic might need adjustment if items change on a 'confirmed' order.
        // For now, assuming updates happen primarily in 'draft' status or only affect non-stock related fields.
        // If items of a confirmed order can change, checkAndAllocateStock logic needs revisiting here.

        return updatedOrder;
      });
    }),

    // TODO: Implement deleteOrder procedure (consider constraints)

}); 