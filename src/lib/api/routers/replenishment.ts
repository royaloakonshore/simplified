import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, companyProtectedProcedure } from '@/lib/api/trpc';
import { prisma } from '@/lib/db';
import { ItemType, Prisma } from '@prisma/client';

// Schema for bulk updates
const BulkUpdateReplenishmentSchema = z.object({
  itemIds: z.array(z.string()),
  updates: z.object({
    leadTimeDays: z.number().min(0).optional(),
    reorderLevel: z.number().min(0).optional(),
  }),
});

export const replenishmentRouter = createTRPCRouter({
  // Get critical alerts - items below reorder level
  getCriticalAlerts: companyProtectedProcedure
    .query(async ({ ctx }) => {
      // First get all raw materials for this company
      const rawMaterials = await prisma.inventoryItem.findMany({
        where: {
          companyId: ctx.companyId,
          itemType: ItemType.RAW_MATERIAL,
        },
        include: {
          inventoryCategory: true,
        },
      });

      // Filter for items below reorder level and calculate urgency
      const criticalItems = rawMaterials
        .filter(item => {
          const reorderLevel = Number(item.reorderLevel || 0);
          const currentStock = Number(item.quantityOnHand);
          return currentStock <= reorderLevel;
        })
        .map(item => {
          const reorderLevel = Number(item.reorderLevel || 0);
          const currentStock = Number(item.quantityOnHand);
          
          // Calculate urgency score (0-100)
          let urgencyScore = 50; // base urgency
          
          if (reorderLevel > 0) {
            const stockRatio = currentStock / reorderLevel;
            if (stockRatio === 0) urgencyScore = 100; // Out of stock
            else if (stockRatio <= 0.25) urgencyScore = 90; // Critical
            else if (stockRatio <= 0.5) urgencyScore = 70; // High
            else urgencyScore = 50; // Medium
          }
          
          // Factor in lead time
          const leadTimeDays = item.leadTimeDays || 0;
          if (leadTimeDays > 0) {
            urgencyScore += Math.min(leadTimeDays * 2, 20); // Add urgency for long lead times
          }
          
          urgencyScore = Math.min(urgencyScore, 100);

          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            currentStock,
            reorderLevel,
            leadTimeDays,
            vendorSku: item.vendorSku,
            vendorItemName: item.vendorItemName,
            category: item.inventoryCategory?.name,
            urgencyScore: Math.round(urgencyScore),
          };
        })
        .sort((a, b) => b.urgencyScore - a.urgencyScore); // Sort by urgency

      return criticalItems;
    }),

  // Get all raw materials with replenishment info
  getRawMaterials: companyProtectedProcedure
    .input(z.object({
      search: z.string().optional(),
      sortBy: z.enum(['name', 'sku', 'quantityOnHand', 'reorderLevel', 'leadTimeDays']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { search, sortBy, sortOrder, page, limit } = input;
      
      // Build where clause
      const where: Prisma.InventoryItemWhereInput = {
        companyId: ctx.companyId,
        itemType: ItemType.RAW_MATERIAL,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { vendorSku: { contains: search, mode: 'insensitive' } },
          { vendorItemName: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Build order by
      const orderBy: Prisma.InventoryItemOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      // Get total count
      const total = await prisma.inventoryItem.count({ where });

      // Get items
      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          inventoryCategory: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      // Add computed fields
      const enhancedItems = items.map(item => ({
        ...item,
        category: item.inventoryCategory?.name,
        isLowStock: Number(item.quantityOnHand) <= Number(item.reorderLevel || 0),
      }));

      return {
        items: enhancedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Bulk update replenishment data
  bulkUpdate: companyProtectedProcedure
    .input(BulkUpdateReplenishmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { itemIds, updates } = input;

      // Verify all items belong to this company and are raw materials
      const items = await prisma.inventoryItem.findMany({
        where: {
          id: { in: itemIds },
          companyId: ctx.companyId,
          itemType: ItemType.RAW_MATERIAL,
        },
      });

      if (items.length !== itemIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some items not found or not accessible',
        });
      }

      // Perform bulk update
      const updateData: Prisma.InventoryItemUpdateManyArgs['data'] = {};
      
      if (updates.leadTimeDays !== undefined) {
        updateData.leadTimeDays = updates.leadTimeDays;
      }
      
      if (updates.reorderLevel !== undefined) {
        updateData.reorderLevel = updates.reorderLevel;
      }

      const result = await prisma.inventoryItem.updateMany({
        where: {
          id: { in: itemIds },
          companyId: ctx.companyId,
        },
        data: updateData,
      });

      return {
        success: true,
        updatedCount: result.count,
        message: `Successfully updated ${result.count} items`,
      };
    }),

  // Export to Excel
  exportToExcel: companyProtectedProcedure
    .query(async ({ ctx }) => {
      const rawMaterials = await prisma.inventoryItem.findMany({
        where: {
          companyId: ctx.companyId,
          itemType: ItemType.RAW_MATERIAL,
        },
        include: {
          inventoryCategory: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Format data for Excel export
      const exportData = rawMaterials.map(item => ({
        'SKU': item.sku,
        'Name': item.name,
        'Description': item.description || '',
        'Category': item.inventoryCategory?.name || '',
        'Current Stock': Number(item.quantityOnHand),
        'Reorder Level': Number(item.reorderLevel || 0),
        'Lead Time (Days)': item.leadTimeDays || 0,
        'Vendor SKU': item.vendorSku || '',
        'Vendor Item Name': item.vendorItemName || '',
        'Cost Price': item.costPrice?.toString() || '',
        'Sales Price': item.salesPrice?.toString() || '',
        'Show in Pricelist': item.showInPricelist ? 'Yes' : 'No',
      }));

      const headers = [
        'SKU', 'Name', 'Description', 'Category', 'Current Stock', 
        'Reorder Level', 'Lead Time (Days)', 'Vendor SKU', 'Vendor Item Name',
        'Cost Price', 'Sales Price', 'Show in Pricelist'
      ];

      return {
        data: exportData,
        headers,
        filename: `replenishment-data-${new Date().toISOString().split('T')[0]}.xlsx`,
      };
    }),
}); 