import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc"; // Assuming protectedProcedure for now
import { UpsertBillOfMaterialSchema, GetBillOfMaterialSchema, ListBillOfMaterialsSchema } from "@/lib/schemas/bom.schema";
import { prisma } from "@/lib/db";
import { Decimal } from '@prisma/client/runtime/library';
// import { ItemType } from '@prisma/client'; // Commenting out due to persistent linting issues

// Workaround: Define ItemType string literals directly if import fails
const ItemTypeEnum = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  MANUFACTURED_GOOD: 'MANUFACTURED_GOOD',
} as const;

export const bomRouter = createTRPCRouter({
  upsert: protectedProcedure // Replace with companyProtectedProcedure when ready
    .input(UpsertBillOfMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, name, description, manualLaborCost, manufacturedItemId, items, companyId } = input;

      // TODO: When using companyProtectedProcedure, companyId should come from ctx.companyId
      // For now, we're using it from input for schema consistency.

      // Verify manufacturedItemId is a MANUFACTURED_GOOD
      const manufacturedItem = await prisma.inventoryItem.findUnique({
        where: { id: manufacturedItemId /* TODO: add companyId: companyId */ },
      });

      if (!manufacturedItem) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Manufactured item with ID ${manufacturedItemId} not found.` });
      }
      // Using string literal for ItemType comparison as a workaround
      if (manufacturedItem.itemType !== ItemTypeEnum.MANUFACTURED_GOOD) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Item ${manufacturedItem.name} is not a manufactured good and cannot have a BOM.` });
      }

      // Verify all component items are RAW_MATERIAL and exist
      const componentItemIds = items.map(item => item.componentItemId);
      const componentInventoryItems = await prisma.inventoryItem.findMany({
        where: {
          id: { in: componentItemIds },
          // TODO: add companyId: companyId 
        },
      });

      if (componentInventoryItems.length !== componentItemIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more component items not found.' });
      }

      for (const compItem of componentInventoryItems) {
        // Using string literal for ItemType comparison as a workaround
        if (compItem.itemType !== ItemTypeEnum.RAW_MATERIAL) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Component item ${compItem.name} (ID: ${compItem.id}) is not a raw material.`,
          });
        }
      }
      
      const componentCostsMap = new Map(componentInventoryItems.map(item => [item.id, item.costPrice]));

      // Calculate totalCalculatedCost
      let calculatedCost = new Decimal(0);
      for (const bomItem of items) {
        const cost = componentCostsMap.get(bomItem.componentItemId);
        if (cost == null) { // Should not happen due to checks above
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Cost not found for component ${bomItem.componentItemId}` });
        }
        calculatedCost = calculatedCost.plus(new Decimal(cost).times(new Decimal(bomItem.quantity)));
      }
      calculatedCost = calculatedCost.plus(new Decimal(manualLaborCost));

      return prisma.$transaction(async (tx) => {
        const bomData = {
          name,
          description,
          manualLaborCost: new Decimal(manualLaborCost),
          manufacturedItemId,
          totalCalculatedCost: calculatedCost, // Store calculated cost
          companyId, // TODO: Replace with ctx.companyId
        };

        let billOfMaterial;

        if (id) { // Update existing BOM
          billOfMaterial = await tx.billOfMaterial.update({
            where: { id /* TODO: add companyId: companyId */ },
            data: {
              ...bomData,
              items: {
                deleteMany: {}, // Delete existing items
                create: items.map(item => ({
                  quantity: new Decimal(item.quantity),
                  companyId, // TODO: ctx.companyId
                  componentItemId: item.componentItemId, // Set FK directly
                })),
              },
            },
            include: { items: true },
          });
        } else { // Create new BOM
          // Check if a BOM already exists for this manufactured item (as manufacturedItemId is @unique on BOM)
          const existingBOM = await tx.billOfMaterial.findUnique({
            where: { manufacturedItemId /* TODO: add companyId: companyId */ }
          });
          if (existingBOM) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `A Bill of Material already exists for manufactured item ID ${manufacturedItemId}. Please update the existing one.`,
            });
          }

          billOfMaterial = await tx.billOfMaterial.create({
            data: {
              ...bomData,
              items: {
                create: items.map(item => ({
                  quantity: new Decimal(item.quantity),
                  companyId, // TODO: ctx.companyId
                  componentItemId: item.componentItemId, // Set FK directly
                })),
              },
            },
            include: { items: true },
          });
        }
        return billOfMaterial;
      });
    }),

  get: protectedProcedure // Replace with companyProtectedProcedure
    .input(GetBillOfMaterialSchema)
    .query(async ({ ctx, input }) => {
      // const companyId = ctx.companyId; // TODO
      const bom = await prisma.billOfMaterial.findUnique({
        where: { id: input.id /* TODO: add companyId */ },
        include: {
          manufacturedItem: { select: { id: true, name: true, sku: true }},
          items: {
            include: {
              componentItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true, costPrice: true }},
            },
          },
        },
      });
      if (!bom) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill of Material not found.' });
      }
      return bom;
    }),
  
  list: protectedProcedure // Replace with companyProtectedProcedure
    .input(ListBillOfMaterialsSchema)
    .query(async ({ ctx, input }) => {
      const { companyId, manufacturedItemId } = input; // TODO: companyId from ctx
      const boms = await prisma.billOfMaterial.findMany({
        where: { 
          companyId, 
          manufacturedItemId: manufacturedItemId ?? undefined,
        },
        include: {
          manufacturedItem: { select: { id: true, name: true, sku: true }},
          _count: { select: { items: true } }
        },
        orderBy: { name: 'asc' }
      });
      return boms;
    }),
  
  delete: protectedProcedure // Replace with companyProtectedProcedure
    .input(z.object({ id: z.string().cuid(), /* companyId: z.string().cuid() TODO */ }))
    .mutation(async ({ ctx, input }) => {
      // const companyId = ctx.companyId; // TODO
      // First check if it exists and belongs to the company
      const bom = await prisma.billOfMaterial.findUnique({
        where: { id: input.id /* TODO: add companyId */ }
      });
      if (!bom /*|| bom.companyId !== companyId*/) {
         throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill of Material not found or access denied.' });
      }
      
      await prisma.billOfMaterial.delete({
        where: { id: input.id },
      });
      return { success: true, id: input.id };
    }),
}); 