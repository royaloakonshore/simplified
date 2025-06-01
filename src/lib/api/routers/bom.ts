import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { UpsertBillOfMaterialSchema, GetBillOfMaterialSchema, ListBillOfMaterialsSchema } from "@/lib/schemas/bom.schema";
import { prisma } from "@/lib/db";
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, ItemType } from '@prisma/client';
// import { ItemType } from '@prisma/client'; // Commenting out due to persistent linting issues

// Workaround: Define ItemType string literals directly if import fails
const ItemTypeEnum = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  MANUFACTURED_GOOD: 'MANUFACTURED_GOOD',
} as const;

export const bomRouter = createTRPCRouter({
  upsert: protectedProcedure
    .input(UpsertBillOfMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, name, description, manualLaborCost, manufacturedItemId, items, companyId } = input;

      // TODO: When multi-tenancy is fully active, companyId should primarily come from ctx.session.user.companyId
      // and input.companyId could be used for an explicit override if allowed by roles.
      // For now, ensure the input companyId is respected or matches context if available.
      // if (ctx.session.user.companyId && ctx.session.user.companyId !== companyId) {
      //   throw new TRPCError({ code: 'FORBIDDEN', message: 'Company ID mismatch.' });
      // }

      if (manufacturedItemId) {
        const mfgItem = await prisma.inventoryItem.findUnique({ where: { id: manufacturedItemId, companyId } });
        if (!mfgItem) throw new TRPCError({ code: 'BAD_REQUEST', message: `Manufactured item ID ${manufacturedItemId} not found.` });
        if (mfgItem.itemType !== ItemType.MANUFACTURED_GOOD) throw new TRPCError({ code: 'BAD_REQUEST', message: `Item ${mfgItem.name} is not a manufactured good.` });
      }

      const componentItemIds = items.map(item => item.componentItemId);
      const componentInventoryItems = await prisma.inventoryItem.findMany({ where: { id: { in: componentItemIds }, companyId } });
      if (componentInventoryItems.length !== componentItemIds.length) {
        const foundIds = new Set(componentInventoryItems.map(it => it.id));
        const missingIds = componentItemIds.filter(itId => !foundIds.has(itId));
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Component items not found: ${missingIds.join(', ')}.` });
      }
      for (const compItem of componentInventoryItems) {
        if (compItem.itemType !== ItemType.RAW_MATERIAL) throw new TRPCError({ code: 'BAD_REQUEST', message: `Component ${compItem.name} is not raw material.` });
      }
      
      let calculatedCost = items.reduce((acc, item) => {
        const costPrice = componentInventoryItems.find(ci => ci.id === item.componentItemId)?.costPrice || new Decimal(0);
        return acc.plus(new Decimal(costPrice).times(new Decimal(item.quantity)));
      }, new Decimal(0));
      calculatedCost = calculatedCost.plus(new Decimal(manualLaborCost));

      const baseData = {
        name,
        description,
        manualLaborCost: new Decimal(manualLaborCost),
        totalCalculatedCost: calculatedCost,
        companyId,
      };

      try {
        if (id) { // Update
          // Pre-flight unique checks for update
          if (input.name) {
            const existingByName = await prisma.billOfMaterial.findFirst({ where: { name: input.name, companyId, id: { not: id } } });
            if (existingByName) throw new TRPCError({ code: 'CONFLICT', message: `BOM name "${input.name}" already exists.` });
          }
          // For manufacturedItemId, input can be string, null, or undefined.
          // If string or null, we check for conflict. If undefined, no change to manufacturedItemId, so no conflict check needed for it.
          if (input.manufacturedItemId !== undefined) { 
            const existingByMfgItem = await prisma.billOfMaterial.findFirst({ 
                where: {
                  companyId,
                  id: { not: id },
                  manufacturedItemId: input.manufacturedItemId === null ? { equals: null } : input.manufacturedItemId
                }
            });
            if (existingByMfgItem && input.manufacturedItemId !== null) { 
                throw new TRPCError({ code: 'CONFLICT', message: `Manufactured item already has another BOM.` });
            }
          }

          const updateData: Prisma.BillOfMaterialUpdateInput = {
            ...baseData,
            // Let Prisma handle manufacturedItemId: if input.manufacturedItemId is undefined, it's not included and thus not changed.
            // If input.manufacturedItemId is string or null, it's included and will be set.
            ...(input.manufacturedItemId !== undefined && { manufacturedItemId: input.manufacturedItemId }),
            items: { 
              deleteMany: { billOfMaterialId: id }, 
              create: items.map(item => ({
                componentItemId: item.componentItemId,
                quantity: new Decimal(item.quantity),
                companyId,
              })),
            },
          };
          
          return await prisma.billOfMaterial.update({
            where: { id, companyId },
            data: updateData,
            include: {
              items: true,
              manufacturedItem: input.manufacturedItemId ? { select: { id: true, name: true, sku: true } } : undefined,
              _count: { select: { items: true } },
            },
          });
        } else { // Create
          const createDataInitial: Omit<Prisma.BillOfMaterialCreateInput, 'manufacturedItem' | 'items'> & { items: Prisma.BillOfMaterialCreateInput['items'], manufacturedItemId?: string | null } = {
            ...baseData,
            items: {
              create: items.map(item => ({
                componentItemId: item.componentItemId,
                quantity: new Decimal(item.quantity),
                companyId,
              })),
            },
          };
          // Only add manufacturedItemId to payload if it is not undefined
          if (manufacturedItemId !== undefined) {
            createDataInitial.manufacturedItemId = manufacturedItemId; // string | null
          }

          // Pre-flight checks for unique constraints on create
          const existingByName = await prisma.billOfMaterial.findUnique({ where: { name, companyId } });
          if (existingByName) throw new TRPCError({ code: 'CONFLICT', message: `BOM name "${name}" already exists.` });
          
          // Check manufacturedItemId conflict only if it's not null and not undefined
          if (createDataInitial.manufacturedItemId) { 
            const existingByMfgItem = await prisma.billOfMaterial.findUnique({ 
              where: { manufacturedItemId: createDataInitial.manufacturedItemId, companyId } 
            });
            if (existingByMfgItem) throw new TRPCError({ code: 'CONFLICT', message: `Manufactured item already has a BOM.` });
          }
          
          return await prisma.billOfMaterial.create({
            data: createDataInitial as Prisma.BillOfMaterialCreateInput, // Cast needed due to conditional manufacturedItemId
            include: {
              items: true,
              manufacturedItem: createDataInitial.manufacturedItemId ? { select: { id: true, name: true, sku: true } } : undefined,
              _count: { select: { items: true } },
            },
          });
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && error.meta?.target) {
          const target = Array.isArray(error.meta.target) ? error.meta.target.join(', ') : error.meta.target;
          throw new TRPCError({ code: 'CONFLICT', message: `A Bill of Material with this ${target} already exists.` });
        }
        console.error("Error upserting BOM:", error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create/update BOM.', cause: error });
      }
    }),

  get: protectedProcedure
    .input(GetBillOfMaterialSchema)
    .query(async ({ ctx, input }) => {
      // TODO: companyId check should use ctx.session.user.companyId if available and enforce it
      const bom = await prisma.billOfMaterial.findUnique({
        where: { id: input.id /* TODO: , companyId: ctx.session.user.companyId */ },
        include: {
          items: {
            include: {
              componentItem: { select: { id: true, name: true, sku: true } },
            },
          },
          manufacturedItem: { select: { id: true, name: true, sku: true } },
          company: { select: { id: true, name: true } },
        },
      });
      if (!bom /* || bom.companyId !== ctx.session.user.companyId */) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found.' });
      }
      return bom;
    }),

  list: protectedProcedure
    .input(ListBillOfMaterialsSchema)
    .query(async ({ ctx, input }) => {
      // TODO: companyId should come from ctx.session.user.companyId and be enforced
      const whereClause: Prisma.BillOfMaterialWhereInput = {
        companyId: input.companyId,
      };

      if (input.manufacturedItemId !== undefined) {
        if (input.manufacturedItemId === null) {
          whereClause.manufacturedItemId = { equals: null };
        } else { // It's a string
          whereClause.manufacturedItemId = input.manufacturedItemId;
        }
      }

      const [boms, totalCount] = await prisma.$transaction([
        prisma.billOfMaterial.findMany({
          where: whereClause,
          include: {
            manufacturedItem: { select: { id: true, name: true, sku: true } },
            _count: { select: { items: true } },
          },
          // TODO: Add orderBy, skip, take from input if pagination is added
        }),
        prisma.billOfMaterial.count({ where: whereClause }),
      ]);

      return {
        data: boms,
        totalCount,
        // page: input.page || 1,
        // perPage: input.perPage || totalCount,
        // totalPages: Math.ceil(totalCount / (input.perPage || totalCount)),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid()/*, companyId: z.string().cuid() // TODO */ }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Enforce companyId from ctx.session.user.companyId
      // First, ensure the BOM exists and belongs to the company (if companyId is available)
      const bomToDelete = await prisma.billOfMaterial.findUnique({
        where: { id: input.id /*, companyId: ctx.session.user.companyId */ }
      });

      if (!bomToDelete) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found or not authorized to delete.' });
      }

      try {
        await prisma.billOfMaterial.delete({
          where: { id: input.id },
        });
        return { success: true, id: input.id };
      } catch (error) {
        console.error("Error deleting BOM:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete Bill of Material.',
          cause: error,
        });
      }
    }),
}); 