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

// Helper function to calculate order total including discounts
const calculateOrderTotal = (items: OrderItemInput[]): Prisma.Decimal => {
  return items.reduce((total: Prisma.Decimal, item: OrderItemInput) => {
    const price = new Prisma.Decimal(item.unitPrice || 0); // Default to 0 if undefined
    const quantity = new Prisma.Decimal(item.quantity);
    let lineTotal = price.mul(quantity);

    // Apply discount if present, prioritizing percentage
    if (item.discountPercent != null && item.discountPercent > 0) {
      const discountMultiplier = new Prisma.Decimal(1).minus(
        new Prisma.Decimal(item.discountPercent).div(100)
      );
      lineTotal = lineTotal.mul(discountMultiplier);
    } else if (item.discountAmount != null && item.discountAmount > 0) {
      // Ensure discount doesn't make line total negative
      const discount = new Prisma.Decimal(item.discountAmount);
      lineTotal = lineTotal.sub(discount).greaterThan(0) ? lineTotal.sub(discount) : new Prisma.Decimal(0);
    }

    return total.add(lineTotal);
  }, new Prisma.Decimal(0));
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
      const userId = ctx.session.user.id;

      // Validate all items have unitPrice (adjust OrderItemInput type if necessary)
      if (items.some((item) => item.unitPrice === undefined || item.unitPrice === null)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unit price must be provided for all order items.',
        });
      }

      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const orderNumber = await generateOrderNumber(tx);

        // Map items for creation, including discounts
        const mappedItemsForCreation = items.map((item) => ({
          itemId: item.itemId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice!),
          discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : null,
          discountPercent: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : null,
        }));

        // Calculate total amount using the updated helper function
        const totalAmount = calculateOrderTotal(items); // Pass original input items

        const order = await tx.order.create({
          data: {
            customerId,
            userId,
            orderNumber,
            status: status ?? OrderStatus.draft,
            orderType: orderType ?? OrderType.work_order,
            totalAmount,
            notes,
            items: {
              create: mappedItemsForCreation, // Use the mapped items with Prisma Decimals
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
    .mutation(async ({ input, ctx }) => {
      const { id, items, ...restData } = input;
      // TODO: Validate user has permission to update this order (e.g., based on userId or companyId)

      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Fetch existing order items if they are being updated
        let existingItems: any[] = [];
        if (items) {
          existingItems = await tx.orderItem.findMany({ where: { orderId: id } });
        }

        // 2. Prepare item updates (delete, create, update)
        const itemsToCreate: Prisma.OrderItemCreateManyInput[] = [];
        const itemsToUpdate: { where: Prisma.OrderItemWhereUniqueInput, data: Prisma.OrderItemUpdateInput }[] = [];
        const itemIdsToDelete: string[] = existingItems.map(item => item.id);

        let calculatedTotalAmount: Prisma.Decimal | undefined = undefined;

        if (items) {
          // Calculate new total based on incoming items
          calculatedTotalAmount = calculateOrderTotal(items as OrderItemInput[]); 

          for (const item of items) {
            const existingItem = existingItems.find(ei => ei.id === item.id);
            const itemData = {
              itemId: item.itemId,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice!),
              discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : null,
              discountPercent: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : null,
            };

            if (existingItem) {
              // Update existing item
              itemsToUpdate.push({ where: { id: item.id! }, data: itemData });
              // Remove from delete list
              const index = itemIdsToDelete.indexOf(item.id!);
              if (index > -1) {
                itemIdsToDelete.splice(index, 1);
              }
            } else {
              // Create new item (needs orderId)
              // We handle creates separately after the main update
            }
          }
        }

        // 3. Update the order itself
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            ...restData,
            ...(calculatedTotalAmount !== undefined && { totalAmount: calculatedTotalAmount }),
            // Item updates are handled separately below
          },
        });

        // 4. Perform item changes
        if (items) {
          // Delete items no longer present
          if (itemIdsToDelete.length > 0) {
            await tx.orderItem.deleteMany({ where: { id: { in: itemIdsToDelete } } });
          }
          // Update existing items
          for (const update of itemsToUpdate) {
            await tx.orderItem.update(update);
          }
          // Create new items
          const newItemsInput = items.filter(item => !item.id);
          if (newItemsInput.length > 0) {
              await tx.orderItem.createMany({
                  data: newItemsInput.map(item => ({
                      orderId: id,
                      itemId: item.itemId,
                      quantity: new Prisma.Decimal(item.quantity),
                      unitPrice: new Prisma.Decimal(item.unitPrice!),
                      discountAmount: item.discountAmount != null ? new Prisma.Decimal(item.discountAmount) : null,
                      discountPercent: item.discountPercent != null ? new Prisma.Decimal(item.discountPercent) : null,
                  }))
              });
          }
        }
        
        // TODO: Re-evaluate stock allocation if status changes or items change
        // This might involve reversing old allocations and creating new ones.
        // For simplicity, this example assumes stock is handled primarily by status changes.

        // Refetch the full order with updated items
        const finalOrder = await tx.order.findUnique({ 
            where: { id },
            include: { items: true, customer: true },
        });

        return finalOrder;
      });
    }),

    // TODO: Implement deleteOrder procedure (consider constraints)

}); 