import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/lib/api/trpc";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
} from "@/lib/schemas/inventory.schema";
import { TransactionType } from '@prisma/client'; // Import enum
import { TRPCError } from '@trpc/server';

export const inventoryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
        // TODO: Add filters (name, sku, materialType?)
      })
    )
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      const { cursor } = input;

      // Fetch items
      const items = await prisma.inventoryItem.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          name: 'asc', // Default sort by name
        },
        // TODO: Add where clause for filters
      });

      // Determine next cursor
      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      // TODO: Consider calculating quantityOnHand here or in a separate procedure/view
      // For now, just returning items.

      return {
        items,
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: input.id },
            // Optionally include recent transactions or quantityOnHand calculation
            // include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } }
        });
        if (!item) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Inventory item not found.',
            });
        }
        // TODO: Calculate quantityOnHand for the specific item
        return item;
    }),

  create: protectedProcedure
    .input(createInventoryItemSchema)
    .mutation(async ({ input }) => {
      // Check if SKU already exists
      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: input.sku },
      });
      if (existingSku) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'SKU already exists. Please use a unique SKU.',
        });
      }
      return await prisma.inventoryItem.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateInventoryItemSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      // Check if SKU is being changed and if the new SKU already exists
      if (data.sku) {
        const existingSku = await prisma.inventoryItem.findFirst({
            where: {
                sku: data.sku,
                id: { not: id } // Exclude the current item itself
            }
        });
        if (existingSku) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'SKU already exists. Please use a unique SKU.',
            });
        }
      }
      try {
        return await prisma.inventoryItem.update({
          where: { id },
          data,
        });
      } catch (error) {
         // Handle potential Prisma errors (e.g., not found)
         throw new TRPCError({
           code: 'INTERNAL_SERVER_ERROR',
           message: 'Failed to update inventory item.',
         });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: Add checks - cannot delete if used in Orders, BOMs etc.?
      // Need to check relationships before deleting.
      try {
        return await prisma.inventoryItem.delete({ where: { id: input.id } });
      } catch (error) {
         // Handle potential Prisma errors (e.g., foreign key constraints)
         throw new TRPCError({
           code: 'INTERNAL_SERVER_ERROR',
           message: 'Failed to delete inventory item. It might be in use.',
         });
      }
    }),

   adjustStock: protectedProcedure
    .input(adjustStockSchema)
    .mutation(async ({ input }) => {
      const { itemId, quantityChange, note } = input;
      // Record the transaction
      // QuantityOnHand is derived from transactions, so no direct update here.
      return await prisma.inventoryTransaction.create({
        data: {
          itemId: itemId,
          quantity: quantityChange,
          type: TransactionType.adjustment, // Defaulting to adjustment for now
          note: note,
        },
      });
    }),

    // TODO: Add procedure to get quantityOnHand for an item or list
}); 