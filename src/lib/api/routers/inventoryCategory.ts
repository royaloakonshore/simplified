import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import {
  createInventoryCategorySchema,
  listInventoryCategoriesSchema,
  type CreateInventoryCategoryInput,
  type ListInventoryCategoriesInput,
} from "@/lib/schemas/inventoryCategory.schema";
import { prisma } from "@/lib/db";
import { Prisma } from '@prisma/client';

export const inventoryCategoryRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createInventoryCategorySchema.omit({ companyId: true }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.companyId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User is not associated with a company or companyId is missing.' });
      }
      const companyId: string = ctx.session.user.companyId;
      const { name, description } = input;

      const existingCategory = await prisma.inventoryCategory.findFirst({
        where: { name, companyId },
      });

      if (existingCategory) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `An inventory category with the name "${name}" already exists.`,
        });
      }

      try {
        const newCategory = await prisma.inventoryCategory.create({
          data: {
            name,
            description,
            companyId,
          },
        });
        return newCategory;
      } catch (error) {
        console.error("Error creating inventory category:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create inventory category: ${message}`,
          cause: error,
        });
      }
    }),

  list: protectedProcedure
    .input(listInventoryCategoriesSchema.omit({ companyId: true }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.companyId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User is not associated with a company or companyId is missing.' });
      }
      const companyId: string = ctx.session.user.companyId;
      const { search, sortBy, sortDirection } = input || {};

      const whereClause: Prisma.InventoryCategoryWhereInput = {
        companyId,
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      try {
        const categories = await prisma.inventoryCategory.findMany({
          where: whereClause,
          orderBy: {
            [sortBy || 'name']: sortDirection || 'asc',
          },
        });
        return categories;
      } catch (error) {
        console.error("Error listing inventory categories:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to list inventory categories: ${message}`,
          cause: error,
        });
      }
    }),

  // TODO: Add get, update, delete procedures as needed
}); 