import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import type { CreateContextReturn } from "@/lib/api/trpc";
import {
  createInventoryCategorySchema,
  // updateInventoryCategorySchema, // Add if update functionality is needed later
  listInventoryCategoriesSchema,
  type CreateInventoryCategoryInput,
  type ListInventoryCategoriesInput,
} from "@/lib/schemas/inventoryCategory.schema";
import { prisma } from "@/lib/db";
import { Prisma, type InventoryCategory } from '@prisma/client';

// Define a type for the context that includes a guaranteed user session and companyId
interface CompanyContext extends CreateContextReturn {
  session: CreateContextReturn['session'] & {
    user: CreateContextReturn['session']['user'] & {
      companyId: string; // Ensure companyId is string
    };
  };
}

export const inventoryCategoryRouter = createTRPCRouter({
  create: protectedProcedure // Changed to protectedProcedure
    .input(createInventoryCategorySchema.omit({ companyId: true })) 
    .mutation(async ({ ctx, input }: { ctx: CompanyContext, input: Omit<CreateInventoryCategoryInput, 'companyId'> }) => {
      if (!ctx.session?.user?.companyId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User is not associated with a company.' });
      }
      const { name, description } = input;
      const { companyId } = ctx.session.user; // Get companyId from session

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
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: "Failed to create inventory category.",
          cause: error,
        });
      }
    }),

  list: protectedProcedure // Changed to protectedProcedure
    .input(listInventoryCategoriesSchema.omit({ companyId: true }).optional()) 
    .query(async ({ ctx, input }: { ctx: CompanyContext, input?: Omit<ListInventoryCategoriesInput, 'companyId'> }) => {
      if (!ctx.session?.user?.companyId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User is not associated with a company.' });
      }
      const { companyId } = ctx.session.user; // Get companyId from session
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
        return categories as InventoryCategory[]; // Ensure correct return type
      } catch (error) {
        console.error("Error listing inventory categories:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: "Failed to list inventory categories.",
          cause: error,
        });
      }
    }),

  // TODO: Add get, update, delete procedures as needed
}); 