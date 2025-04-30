import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/lib/api/trpc";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/lib/schemas/customer.schema";
import type { Address } from '@prisma/client';
import { listCustomersSchema } from "@/lib/schemas/customer.schema";
import { Prisma } from '@prisma/client';

export const customerRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listCustomersSchema)
    .query(async ({ input }) => {
      const { page, perPage, search, sortBy, sortDirection } = input;

      const whereClause: Prisma.CustomerWhereInput = {};
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const skip = (page - 1) * perPage;

      const items = await prisma.customer.findMany({
        skip: skip,
        take: perPage,
        where: whereClause,
        orderBy: {
          [sortBy]: sortDirection,
        },
      });

      const totalCount = await prisma.customer.count({
        where: whereClause,
      });

      const totalPages = Math.ceil(totalCount / perPage);

      return {
        items,
        pagination: {
          page,
          perPage,
          totalCount,
          totalPages,
        },
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await prisma.customer.findUnique({
        where: { id: input.id },
        include: { addresses: true }, // Include addresses by default
      });
    }),

  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { addresses, ...customerData } = input;

      // Use Prisma transaction to create customer and addresses together
      return await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: customerData,
        });

        if (addresses && addresses.length > 0) {
          await tx.address.createMany({
            data: addresses.map((addr: Omit<Address, 'id' | 'customerId'>) => ({
              ...addr,
              customerId: customer.id,
            })),
          });
        }

        return customer;
      });
    }),

  update: protectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, addresses, ...customerData } = input;

      // Use Prisma transaction for update
      return await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.update({
          where: { id },
          data: customerData,
        });

        // Simple approach: delete existing addresses and create new ones
        // More complex logic could be used for merging/updating existing addresses
        await tx.address.deleteMany({
          where: { customerId: id },
        });

        if (addresses && addresses.length > 0) {
          await tx.address.createMany({
            data: addresses.map((addr: Omit<Address, 'id' | 'customerId'>) => ({
              ...addr,
              customerId: customer.id,
            })),
          });
        }

        return customer;
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prisma schema uses onDelete: Cascade for Address, so they'll be deleted too
      // Need to consider related Orders/Invoices - what should happen?
      // For now, simple delete. Add checks/logic later if needed.
      return await prisma.customer.delete({
        where: { id: input.id },
      });
    }),
}); 