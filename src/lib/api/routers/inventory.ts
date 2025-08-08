import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  createTRPCRouter,
  protectedProcedure,
  companyProtectedProcedure,
} from "@/lib/api/trpc";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
  listInventoryItemsSchema,
} from "@/lib/schemas/inventory.schema";
import { TransactionType, Prisma } from '@prisma/client'; // Import enum and Prisma for Decimal
import { TRPCError } from '@trpc/server';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { Buffer } from 'buffer'; // Import Buffer
import { 
  importInventoryFromExcelWithValidation, 
  type ImportPreview, 
  type ExcelInventoryData 
} from '@/lib/services/excel.service';

// Schema for Excel import preview
const ExcelImportPreviewSchema = z.object({
  fileData: z.string(), // Base64 encoded file data
});

// Schema for Excel import apply
const ExcelImportApplySchema = z.object({
  fileData: z.string(), // Base64 encoded file data
  preview: z.object({
    newItems: z.array(z.any()),
    updateItems: z.array(z.any()),
    errors: z.array(z.any()),
    summary: z.object({
      totalRows: z.number(),
      newItemCount: z.number(),
      updateItemCount: z.number(),
      errorCount: z.number(),
      warningCount: z.number(),
    }),
  }),
  confirmed: z.boolean(),
});

export const inventoryRouter = createTRPCRouter({
  // List inventory items with filtering and pagination
  list: companyProtectedProcedure
    .input(listInventoryItemsSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, search, itemType, inventoryCategoryId, showInPricelist, sortBy, sortDirection } = input;

      const whereClause: Prisma.InventoryItemWhereInput = {
        companyId: ctx.companyId, // Ensure company scoping
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (itemType) {
        whereClause.itemType = itemType;
      }

      if (inventoryCategoryId) {
        whereClause.inventoryCategoryId = inventoryCategoryId;
      }

      if (showInPricelist !== undefined) {
        whereClause.showInPricelist = showInPricelist;
      }

      const skip = (page - 1) * perPage;

      const items = await ctx.db.inventoryItem.findMany({
        skip,
        take: perPage,
        where: whereClause,
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          itemType: true,
          quantityOnHand: true,
          costPrice: true,
          salesPrice: true,
          minimumStockLevel: true,
          reorderLevel: true,
          defaultVatRatePercent: true,
          variant: true,
          dimensions: true,
          weight: true,
          inventoryCategory: { select: { id: true, name: true } },
          companyId: true,
          createdAt: true,
          updatedAt: true,
          unitOfMeasure: true,
          qrIdentifier: true,
          showInPricelist: true,
          internalRemarks: true,
          supplierId: true,
          inventoryCategoryId: true,
          leadTimeDays: true,
          vendorSku: true,
          vendorItemName: true,
        },
        orderBy: {
          [sortBy]: sortDirection,
        },
      });

      const totalCount = await ctx.db.inventoryItem.count({
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

  // Enhanced Excel import preview
  previewExcelImport: companyProtectedProcedure
    .input(ExcelImportPreviewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
                 // Get existing inventory items for comparison
         const existingItems = await prisma.inventoryItem.findMany({
           where: { companyId: ctx.companyId },
         });

        // Generate import preview with validation
        const preview = importInventoryFromExcelWithValidation(fileBuffer, existingItems);
        
        return {
          success: true,
          preview,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to process Excel file',
        });
      }
    }),

  // Apply Excel import with transaction safety
  applyExcelImport: companyProtectedProcedure
    .input(ExcelImportApplySchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.confirmed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Import must be confirmed before applying changes',
        });
      }

      if (input.preview.summary.errorCount > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot apply import with validation errors',
        });
      }

      try {
        // Perform all operations in a transaction
        const result = await prisma.$transaction(async (tx) => {
          const createdItems: any[] = [];
          const updatedItems: any[] = [];
          const inventoryTransactions: any[] = [];

          // Create new items
          for (const newItem of input.preview.newItems) {
            const data = newItem as ExcelInventoryData;
            
                         // Find or create category if specified
             let categoryId: string | null = null;
             if (data.category) {
               const category = await tx.inventoryCategory.upsert({
                 where: { 
                   companyId_name: { 
                     companyId: ctx.companyId, 
                     name: data.category 
                   } 
                 },
                 update: {},
                 create: { 
                   name: data.category,
                   companyId: ctx.companyId,
                 },
               });
               categoryId = category.id;
             }

            const createdItem = await tx.inventoryItem.create({
              data: {
                companyId: ctx.companyId,
                name: data.name,
                description: data.description || null,
                sku: data.sku || null,
                costPrice: data.costPrice ? new Prisma.Decimal(data.costPrice) : new Prisma.Decimal(0),
                salesPrice: new Prisma.Decimal(data.salesPrice),
                quantityOnHand: new Prisma.Decimal(data.quantityOnHand || 0),
                reorderLevel: data.reorderLevel ? new Prisma.Decimal(data.reorderLevel) : null,
                leadTimeDays: data.leadTimeDays || null,
                vendorSku: data.vendorSku || null,
                vendorItemName: data.vendorItemName || null,
                minimumStockLevel: new Prisma.Decimal(data.minimumStockLevel || 0),
                itemType: data.itemType || 'MANUFACTURED_GOOD',
                showInPricelist: data.showInPricelist !== false,
                inventoryCategoryId: categoryId,
                defaultVatRatePercent: new Prisma.Decimal(25.5), // Default Finnish VAT
              },
            });

            createdItems.push(createdItem);

                         // Create initial inventory transaction if quantity > 0
             if (data.quantityOnHand && data.quantityOnHand > 0) {
               const transaction = await tx.inventoryTransaction.create({
                 data: {
                   itemId: createdItem.id,
                   type: 'adjustment',
                   quantity: new Prisma.Decimal(data.quantityOnHand),
                   note: 'Initial stock from Excel import',
                 },
               });
               inventoryTransactions.push(transaction);
             }
          }

          // Update existing items
          for (const updateItem of input.preview.updateItems) {
            const { sku, newData, changes } = updateItem;
            const data = newData as ExcelInventoryData;
            
            // Find the existing item
            const existingItem = await tx.inventoryItem.findFirst({
              where: { 
                sku: {
                  equals: sku,
                  mode: 'insensitive'
                },
                companyId: ctx.companyId,
              },
            });

            if (!existingItem) {
              throw new Error(`Item with SKU ${sku} not found during update`);
            }

                         // Handle category update if specified
             let categoryId: string | null = existingItem.inventoryCategoryId;
             if (data.category && 'category' in changes) {
               const category = await tx.inventoryCategory.upsert({
                 where: { 
                   companyId_name: { 
                     companyId: ctx.companyId, 
                     name: data.category 
                   } 
                 },
                 update: {},
                 create: { 
                   name: data.category,
                   companyId: ctx.companyId,
                 },
               });
               categoryId = category.id;
             }

            // Prepare update data
            const updateData: any = {};
            
            if ('name' in changes) updateData.name = data.name;
            if ('description' in changes) updateData.description = data.description || null;
            if ('costPrice' in changes) updateData.costPrice = data.costPrice ? new Prisma.Decimal(data.costPrice) : new Prisma.Decimal(0);
            if ('salesPrice' in changes) updateData.salesPrice = new Prisma.Decimal(data.salesPrice);
            if ('reorderLevel' in changes) updateData.reorderLevel = data.reorderLevel ? new Prisma.Decimal(data.reorderLevel) : null;
            if ('leadTimeDays' in changes) updateData.leadTimeDays = data.leadTimeDays || null;
            if ('vendorSku' in changes) updateData.vendorSku = data.vendorSku || null;
            if ('vendorItemName' in changes) updateData.vendorItemName = data.vendorItemName || null;
            if ('minimumStockLevel' in changes) updateData.minimumStockLevel = new Prisma.Decimal(data.minimumStockLevel || 0);
            if ('itemType' in changes) updateData.itemType = data.itemType || 'MANUFACTURED_GOOD';
            if ('showInPricelist' in changes) updateData.showInPricelist = data.showInPricelist !== false;
            if ('category' in changes) updateData.inventoryCategoryId = categoryId;

            // Handle quantity changes with inventory transactions
            if ('quantityOnHand' in changes && data.quantityOnHand !== undefined) {
              const currentQuantity = existingItem.quantityOnHand?.toNumber() || 0;
              const newQuantity = data.quantityOnHand;
              const difference = newQuantity - currentQuantity;

              if (Math.abs(difference) > 0.001) { // Handle floating point precision
                                 // Create adjustment transaction
                 const transaction = await tx.inventoryTransaction.create({
                   data: {
                     itemId: existingItem.id,
                     type: 'adjustment',
                     quantity: new Prisma.Decimal(difference),
                     note: `Stock adjustment from Excel import: ${currentQuantity} → ${newQuantity}`,
                   },
                 });
                inventoryTransactions.push(transaction);
                
                updateData.quantityOnHand = new Prisma.Decimal(newQuantity);
              }
            }

            // Apply updates if there are any
            if (Object.keys(updateData).length > 0) {
              const updatedItem = await tx.inventoryItem.update({
                where: { id: existingItem.id },
                data: updateData,
              });
              updatedItems.push(updatedItem);
            }
          }

          return {
            createdItems,
            updatedItems,
            inventoryTransactions,
            summary: {
              itemsCreated: createdItems.length,
              itemsUpdated: updatedItems.length,
              transactionsCreated: inventoryTransactions.length,
            },
          };
        });

        return {
          success: true,
          message: `Import completed successfully: ${result.summary.itemsCreated} items created, ${result.summary.itemsUpdated} items updated`,
          summary: result.summary,
        };

      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to apply Excel import',
        });
      }
    }),

  getById: companyProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
        const companyId = ctx.companyId;
        const item = await prisma.inventoryItem.findFirst({
            where: { 
              id: input.id,
              companyId: companyId
            },
            include: { 
                inventoryCategory: true,
             }
        });
        if (!item) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Inventory item not found.',
            });
        }
        const transactions = await prisma.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: input.id },
        });
        const quantityOnHandDecimal = transactions._sum.quantity ?? new Prisma.Decimal(0);
        
        return {
          ...item,
          costPrice: item.costPrice.toString(),
          salesPrice: item.salesPrice.toString(),
          minimumStockLevel: item.minimumStockLevel.toString(),
          reorderLevel: item.reorderLevel?.toString() ?? null, 
          quantityOnHand: quantityOnHandDecimal.toString(),
        };
    }),

  createAndAdjustStock: protectedProcedure
    .input(z.object({
      itemData: createInventoryItemSchema,
      initialStockQuantity: z.number().optional().default(0),
    }))
    .mutation(async ({ input }) => {
      const { itemData, initialStockQuantity } = input;

      const existingSku = await prisma.inventoryItem.findUnique({
        where: { sku: itemData.sku },
      });
      if (existingSku) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'SKU already exists. Please use a unique SKU.',
        });
      }

      return prisma.$transaction(async (tx) => {
        const newItem = await tx.inventoryItem.create({
          data: {
            ...itemData,
            qrIdentifier: 'temp',
          },
        });

        await tx.inventoryItem.update({
          where: { id: newItem.id },
          data: { qrIdentifier: `ITEM:${newItem.id}` },
        });

        if (initialStockQuantity !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: newItem.id,
              quantity: new Prisma.Decimal(initialStockQuantity),
              type: TransactionType.adjustment,
              note: 'Initial stock on creation',
            },
          });
        }
        // Refetch to ensure all fields are present and then convert Decimals
        const createdItem = await tx.inventoryItem.findUnique({ where: { id: newItem.id } });
        if (!createdItem) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve created item.'});

        return {
            ...createdItem,
            costPrice: createdItem.costPrice.toString(),
            salesPrice: createdItem.salesPrice.toString(),
            minimumStockLevel: createdItem.minimumStockLevel.toString(),
            reorderLevel: createdItem.reorderLevel?.toString() ?? null,
            // quantityOnHand is not directly on createdItem here, it's managed by transactions
            // The list/getById will calculate and convert it.
        };
      });
    }),

  updateAndAdjustStock: protectedProcedure
    .input(z.object({
      itemData: updateInventoryItemSchema,
      stockAdjustment: z.number().optional().default(0),
      adjustmentNote: z.string().optional().default("Manual adjustment"),
    }))
    .mutation(async ({ input }) => {
      const { itemData, stockAdjustment, adjustmentNote } = input;
      const { id, ...dataToUpdate } = itemData;

      if (dataToUpdate.sku) {
        const existingSku = await prisma.inventoryItem.findFirst({
          where: {
            sku: dataToUpdate.sku,
            id: { not: id },
          },
        });
        if (existingSku) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'SKU already exists. Please use a unique SKU.',
          });
        }
      }

      return prisma.$transaction(async (tx) => {
        const updatedItem = await tx.inventoryItem.update({
          where: { id },
          data: dataToUpdate,
        });

        if (stockAdjustment !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: id,
              quantity: new Prisma.Decimal(stockAdjustment),
              type: TransactionType.adjustment,
              note: adjustmentNote,
            },
          });
        }
        // Fetch the item again to get potentially updated quantityOnHand after transaction
        const finalItem = await tx.inventoryItem.findUnique({ where: { id }});
        if (!finalItem) throw new TRPCError({code: "INTERNAL_SERVER_ERROR", message: "Failed to refetch item after update."}) 
        
        const transactions = await tx.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: id },
        });
        const quantityOnHand = transactions._sum.quantity ?? new Prisma.Decimal(0);

        return {
          item: {
            ...finalItem,
            costPrice: finalItem.costPrice.toString(),
            salesPrice: finalItem.salesPrice.toString(),
            minimumStockLevel: finalItem.minimumStockLevel.toString(),
            reorderLevel: finalItem.reorderLevel?.toString() ?? null,
            quantityOnHand: quantityOnHand.toString(),
          },
          transactionCreated: stockAdjustment !== 0
        };
      });
    }),

  create: companyProtectedProcedure
    .input(createInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { quantityOnHand, ...itemData } = input;
      const userId = ctx.session.user.id;
      const companyId = ctx.companyId;

      if (itemData.sku) {
        const existingSku = await prisma.inventoryItem.findUnique({
          where: { sku: itemData.sku },
        });
        if (existingSku) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'SKU already exists. Please use a unique SKU.',
          });
        }
      }

      return prisma.$transaction(async (tx) => {
        const newItem = await tx.inventoryItem.create({
          data: {
            ...itemData,
            companyId,
            quantityOnHand: new Prisma.Decimal(quantityOnHand ?? 0),
          },
        });

        const itemWithQr = await tx.inventoryItem.update({
          where: { id: newItem.id },
          data: { qrIdentifier: `ITEM:${newItem.id}` },
        });

        if (quantityOnHand !== null && quantityOnHand !== undefined && quantityOnHand !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId: itemWithQr.id,
              quantity: new Prisma.Decimal(quantityOnHand),
              type: TransactionType.adjustment,
              note: 'Initial stock on creation',
            },
          });
        }

        // Refetch the full item to ensure all fields are present for the return
        const finalCreatedItem = await tx.inventoryItem.findUnique({
          where: {id: itemWithQr.id},
          include: { inventoryCategory: true } // Include category if needed for return consistency
        });

        if (!finalCreatedItem) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve created item after QR update.'});
        }

        return {
            ...finalCreatedItem,
            costPrice: finalCreatedItem.costPrice.toString(),
            salesPrice: finalCreatedItem.salesPrice.toString(),
            minimumStockLevel: finalCreatedItem.minimumStockLevel.toString(),
            reorderLevel: finalCreatedItem.reorderLevel?.toString() ?? null,
            quantityOnHand: finalCreatedItem.quantityOnHand.toString(),
            // leadTimeDays, vendorSku, vendorItemName should be directly on finalCreatedItem
        };
      });
    }),

  update: companyProtectedProcedure
    .input(updateInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, quantityOnHand, ...dataToUpdate } = input;
      const userId = ctx.session.user.id;
      const companyId = ctx.companyId;

      if (dataToUpdate.sku) {
        const existingSku = await prisma.inventoryItem.findFirst({
          where: {
            sku: dataToUpdate.sku,
            id: { not: id },
          },
        });
        if (existingSku) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'SKU already exists. Please use a unique SKU.',
          });
        }
      }

      return prisma.$transaction(async (tx) => {
        const currentItemTransactions = await tx.inventoryTransaction.aggregate({
          _sum: { quantity: true },
          where: { itemId: id },
        });
        const currentActualQOH = currentItemTransactions._sum.quantity ?? new Prisma.Decimal(0);

        const itemBeingUpdated = await tx.inventoryItem.update({
          where: { id },
          data: {
            ...dataToUpdate,
            ...(quantityOnHand !== undefined && { quantityOnHand: new Prisma.Decimal(quantityOnHand) }),
          },
        });

        if (quantityOnHand !== undefined && quantityOnHand !== null) {
          const targetQOH = new Prisma.Decimal(quantityOnHand);
          const adjustmentAmount = targetQOH.minus(currentActualQOH);

          if (!adjustmentAmount.isZero()) {
            await tx.inventoryTransaction.create({
              data: {
                itemId: id,
                quantity: adjustmentAmount,
                type: TransactionType.adjustment,
                note: 'Stock adjustment from item update',
              },
            });
          }
        }
        
        const finalTransactions = await tx.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: id },
        });
        const finalActualQOH = finalTransactions._sum.quantity ?? new Prisma.Decimal(0);

        // Refetch the full item
        const finalUpdatedItem = await tx.inventoryItem.findUnique({
            where: {id: itemBeingUpdated.id},
            include: { inventoryCategory: true }
        });
        if (!finalUpdatedItem) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve updated item.'});
        }

        return {
            ...finalUpdatedItem,
            costPrice: finalUpdatedItem.costPrice.toString(),
            salesPrice: finalUpdatedItem.salesPrice.toString(),
            minimumStockLevel: finalUpdatedItem.minimumStockLevel.toString(),
            reorderLevel: finalUpdatedItem.reorderLevel?.toString() ?? null,
            quantityOnHand: finalActualQOH.toString(), // Use calculated QOH
        };
      });
    }),

  delete: companyProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const companyId = ctx.companyId;
      
      // First verify the item belongs to the company
      const item = await prisma.inventoryItem.findFirst({
        where: { id, companyId },
      });
      
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory item not found or not accessible.',
        });
      }
      
      // Check for related records before deleting
      const relatedOrders = await prisma.orderItem.count({ where: { inventoryItemId: id } });
      const relatedBoms = await prisma.billOfMaterialItem.count({ where: { componentItemId: id } });

      if (relatedOrders > 0 || relatedBoms > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete item. It is used in orders or bills of material.',
        });
      }

      return await prisma.inventoryItem.delete({
        where: { id },
      });
    }),

  adjustStock: companyProtectedProcedure
    .input(adjustStockSchema)
    .mutation(async ({ ctx, input }) => {
      const { itemId, quantityChange, note } = input;
      const companyId = ctx.companyId;

      if (quantityChange === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Quantity change cannot be zero.',
        });
      }
      
      // Verify the item belongs to the company
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, companyId },
      });
      
      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory item not found or not accessible.',
        });
      }
      
      const transactionType = quantityChange > 0 ? TransactionType.purchase : TransactionType.adjustment;

      return await prisma.inventoryTransaction.create({
        data: {
          itemId: itemId,
          quantity: new Prisma.Decimal(quantityChange),
          type: transactionType,
          reference: 'Manual Adjustment',
          note: note ?? (quantityChange > 0 ? 'Stock-in' : 'Stock-out'),
        },
      });
    }),

  adjustStockFromScan: protectedProcedure
    .input(z.object({
      itemId: z.string().cuid(),
      quantityAdjustment: z.number(),
      newCostPrice: z.number().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { itemId, quantityAdjustment, newCostPrice } = input;

      if (quantityAdjustment === 0 && newCostPrice === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either quantity adjustment must be non-zero or new cost price must be provided.',
        });
      }

      return prisma.$transaction(async (tx) => {
        if (quantityAdjustment !== 0) {
            await tx.inventoryTransaction.create({
              data: {
                itemId: itemId,
                quantity: new Prisma.Decimal(quantityAdjustment),
                type: quantityAdjustment > 0 ? TransactionType.purchase : TransactionType.adjustment,
                reference: 'Scanned Adjustment',
              },
            });
        }

        const updateData: Prisma.InventoryItemUpdateInput = {};
        if (newCostPrice !== undefined) {
          updateData.costPrice = new Prisma.Decimal(newCostPrice);
        }
        
        const allTransactions = await tx.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: itemId },
        });
        updateData.quantityOnHand = allTransactions._sum.quantity ?? new Prisma.Decimal(0);
        
        await tx.inventoryItem.update({
            where: { id: itemId },
            data: updateData,
        });
        
        const finalItem = await tx.inventoryItem.findUnique({ 
            where: { id: itemId },
            include: { inventoryCategory: true }
        });
        if (!finalItem) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to refetch item after scan adjustment." });

        return {
            ...finalItem,
            costPrice: finalItem.costPrice.toString(),
            salesPrice: finalItem.salesPrice.toString(),
            minimumStockLevel: finalItem.minimumStockLevel.toString(),
            reorderLevel: finalItem.reorderLevel?.toString() ?? null,
            quantityOnHand: finalItem.quantityOnHand.toString(),
        };
      });
    }),

  generateQrCodePdf: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string().cuid()) }))
    .mutation(async ({ input }) => {
      const { itemIds } = input;
      if (!itemIds || itemIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No item IDs provided for PDF generation.',
        });
      }

      const items = await prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, sku: true, qrIdentifier: true },
      });

      if (items.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No items found for the provided IDs.',
        });
      }

      let htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
              .page-container { display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: flex-start; padding: 10mm; gap: 5mm; page-break-after: always; }
              .tag { width: 60mm; height: 35mm; border: 1px solid #ccc; padding: 5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; overflow: hidden; }
              .tag-header { font-size: 10pt; font-weight: bold; margin-bottom: 2mm; word-break: break-word; }
              .tag-sku { font-size: 8pt; color: #555; margin-bottom: 3mm; }
              .qr-code { width: 20mm; height: 20mm; margin: 0 auto; }
              @media print {
                .page-container { padding: 0; gap: 0; }
                .tag { border: none; margin: 2mm; }
              }
            </style>
          </head>
          <body>
            <div class="page-container">
      `;

      for (const item of items) {
        if (!item.qrIdentifier) {
          console.warn(`Item ${item.name} (SKU: ${item.sku}) is missing a QR identifier. Skipping.`);
          htmlContent += `
            <div class="tag">
              <div class="tag-header">${item.name}</div>
              <div class="tag-sku">SKU: ${item.sku}</div>
              <div>QR NOT AVAILABLE</div>
            </div>
          `;
          continue;
        }
        try {
          const qrCodeDataURL = await QRCode.toDataURL(item.qrIdentifier, { errorCorrectionLevel: 'H', width: 150 });
          htmlContent += `
            <div class="tag">
              <div class="tag-header">${item.name}</div>
              <div class="tag-sku">SKU: ${item.sku}</div>
              <img src="${qrCodeDataURL}" alt="QR Code for ${item.name}" class="qr-code" />
            </div>
          `;
        } catch (err) {
          console.error(`Failed to generate QR code for item ${item.id}:`, err);
          htmlContent += `
            <div class="tag">
              <div class="tag-header">${item.name} (Error generating QR)</div>
              <div class="tag-sku">SKU: ${item.sku}</div>
              <div class="qr-code">Error</div>
            </div>
          `;
        }
      }

      htmlContent += `
            </div>
          </body>
        </html>
      `;

      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      await browser.close();

      return {
        success: true,
        pdfBase64: (pdfBuffer as Buffer).toString('base64'), // Assert to Node.js Buffer
        message: 'QR Code PDF generated successfully.',
      };
    }),

  quickAdjustStock: protectedProcedure
    .input(z.object({
      itemId: z.string().cuid(),
      newQuantityOnHand: z.number(),
      originalQuantityOnHand: z.number(),
      note: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { itemId, newQuantityOnHand, originalQuantityOnHand, note } = input;
      const userId = ctx.session.user.id;

      return prisma.$transaction(async (tx) => {
        const quantityAdjustment = new Prisma.Decimal(newQuantityOnHand).minus(new Prisma.Decimal(originalQuantityOnHand));

        if (!quantityAdjustment.isZero()) {
            await tx.inventoryTransaction.create({
                data: {
                itemId,
                quantity: quantityAdjustment,
                type: TransactionType.adjustment,
                note,
                },
            });
        }

        await tx.inventoryItem.update({
            where: { id: itemId },
            data: { quantityOnHand: new Prisma.Decimal(newQuantityOnHand) },
        });
        
        const finalTransactions = await tx.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: itemId },
        });
        const finalActualQOH = finalTransactions._sum.quantity ?? new Prisma.Decimal(0);

        // Refetch the full item
        const finalAdjustedItem = await tx.inventoryItem.findUnique({
            where: {id: itemId},
            include: {inventoryCategory: true}
        });

        if (!finalAdjustedItem) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve item after quick adjustment.'});
        }

        return {
            ...finalAdjustedItem,
            costPrice: finalAdjustedItem.costPrice.toString(),
            salesPrice: finalAdjustedItem.salesPrice.toString(),
            minimumStockLevel: finalAdjustedItem.minimumStockLevel.toString(),
            reorderLevel: finalAdjustedItem.reorderLevel?.toString() ?? null,
            quantityOnHand: finalActualQOH.toString(), // Use calculated QOH from transactions
        };
      });
    }),

  getAllCategories: protectedProcedure
    .query(async ({ ctx }) => {
      return prisma.inventoryCategory.findMany({
        orderBy: { name: 'asc' },
      });
    }),

  getReplenishmentAlerts: companyProtectedProcedure
    .query(async ({ ctx }) => {
      const { companyId } = ctx;
      
      // Get all inventory items for the company
      const allItems = await prisma.inventoryItem.findMany({
        where: {
          companyId,
        },
        orderBy: [
          { itemType: 'asc' }, 
          { name: 'asc' },
        ],
      });

      // Filter items that need replenishment using JavaScript logic
      const alertItems = allItems.filter(item => {
        const qoh = item.quantityOnHand;
        const minStock = item.minimumStockLevel;
        const reorderLevel = item.reorderLevel;
        
        // Check if below minimum stock level
        const belowMinStock = qoh.lte(minStock);
        
        // Check if below reorder level (if set)
        const belowReorderLevel = reorderLevel && qoh.lte(reorderLevel);
        
        return belowMinStock || belowReorderLevel;
      });

      // Convert Decimal fields to strings for client
      return alertItems.map(item => ({
        ...item,
        quantityOnHand: item.quantityOnHand.toString(),
        reorderLevel: item.reorderLevel?.toString() ?? null,
        minimumStockLevel: item.minimumStockLevel.toString(),
        costPrice: item.costPrice.toString(),
        salesPrice: item.salesPrice.toString(),
      }));
    }),

  getLowStockItems: companyProtectedProcedure
    .query(async ({ ctx }) => {
      const { companyId } = ctx;
      
      const items = await prisma.inventoryItem.findMany({
        where: {
          companyId,
        },
        include: {
          inventoryTransactions: {
            select: {
              quantity: true,
            },
          },
        },
      });

      const lowStockItems = items
        .map(item => {
          const quantityOnHand = item.inventoryTransactions.reduce(
            (sum, t) => sum.add(t.quantity),
            new Prisma.Decimal(0)
          );

          return {
            ...item,
            quantityOnHand,
          };
        })
        .filter(item => {
          if (item.minimumStockLevel === null) {
            return false;
          }
          return item.quantityOnHand.lessThanOrEqualTo(item.minimumStockLevel);
        })
        .map(item => ({
          ...item,
            costPrice: item.costPrice.toString(),
            salesPrice: item.salesPrice.toString(),
            minimumStockLevel: item.minimumStockLevel.toString(),
            reorderLevel: item.reorderLevel?.toString() ?? null,
            quantityOnHand: item.quantityOnHand.toString()
        }));

      return lowStockItems;
    }),
  
  // generateAndPrintQRCodes: protectedProcedure
  //   .input(z.object({ itemIds: z.array(z.string()) }))
  //   .mutation(async ({ input }) => {
  //     const { itemIds } = input;
  //     const items = await prisma.inventoryItem.findMany({
  //       where: { id: { in: itemIds } },
  //     });

  //     let htmlContent = `
  //       <html>
  //         <head>
  //           <style>
  //             @page { size: A4; margin: 1cm; }
  //             body { font-family: sans-serif; }
  //             .grid-container { display: grid; grid-template-columns: repeat(4, 1fr); grid-gap: 10px; }
  //             .qr-code-item { border: 1px solid #ccc; padding: 10px; text-align: center; }
  //             .qr-code-item img { max-width: 100%; height: auto; }
  //             .item-name { font-weight: bold; margin-top: 5px; }
  //             .item-sku { font-size: 0.8em; color: #555; }
  //           </style>
  //         </head>
  //         <body>
  //           <div class="grid-container">
  //     `;

  //     for (const item of items) {
  //       const qrIdentifier = `ITEM:${item.id}`;
  //       const qrCodeDataUrl = await QRCode.toDataURL(qrIdentifier, { errorCorrectionLevel: 'H' });
        
  //       htmlContent += `
  //         <div class="qr-code-item">
  //           <img src="${qrCodeDataUrl}" alt="QR Code for ${item.name}" />
  //           <div class="item-name">${item.name}</div>
  //           <div class="item-sku">SKU: ${item.sku}</div>
  //         </div>
  //       `;
  //     }

  //     htmlContent += `
  //           </div>
  //         </body>
  //       </html>
  //     `;

  //     const browser = await puppeteer.launch({ headless: true });
  //     const page = await browser.newPage();
  //     await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  //     const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  //     await browser.close();

  //     return {
  //       pdfBase64: pdfBuffer.toString('base64'),
  //     };
  //   }),

  // New endpoint to find an item by its QR identifier
  findByQrIdentifier: protectedProcedure
    .input(z.object({ qrIdentifier: z.string() }))
    .query(async ({ input }) => {
        const { qrIdentifier } = input;

        if (!qrIdentifier.startsWith('ITEM:')) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Invalid QR identifier format.',
            });
        }
        
        const itemId = qrIdentifier.split(':')[1];

        if (!itemId) {
             throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Item ID missing from QR identifier.',
            });
        }

        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Item with ID ${itemId} not found.`,
            });
        }
        
        // Convert Decimal fields to string for client-side consumption
        return {
            ...item,
            costPrice: item.costPrice.toString(),
            salesPrice: item.salesPrice.toString(),
            minimumStockLevel: item.minimumStockLevel.toString(),
            reorderLevel: item.reorderLevel?.toString() ?? null,
        };
    }),

    getTransactions: protectedProcedure
        .input(z.object({ itemId: z.string() }))
        .query(async ({ input }) => {
            const { itemId } = input;
            const transactions = await prisma.inventoryTransaction.findMany({
                where: { itemId },
                orderBy: { createdAt: 'desc' },
                // include: { user: true } // If you want to show who made the transaction
            });
            return transactions.map(t => ({...t, quantity: t.quantity.toString()}));
        }),

    getPresignedUrlForUpload: protectedProcedure
        .input(z.object({
            itemId: z.string(),
            fileName: z.string(),
            fileType: z.string(),
        }))
        .mutation(async ({ input }) => {
            // This is a placeholder. In a real app, you would use a service like AWS S3.
            // You would generate a presigned URL here that the client can use to upload the file directly.
            // For example, using the AWS SDK v3:
            //
            // import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
            // import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
            //
            // const s3Client = new S3Client({ region: "your-region" });
            // const command = new PutObjectCommand({
            //   Bucket: "your-bucket-name",
            //   Key: `inventory/${input.itemId}/${input.fileName}`,
            //   ContentType: input.fileType,
            // });
            // const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            //
            // await prisma.inventoryItem.update({
            //   where: { id: input.itemId },
            //   data: { imageUrl: `s3-url-path...` } // Store a reference, not the full signed URL
            // });
            //
            // return { signedUrl };
            
            console.log("Generating presigned URL for", input);
            // Simulating a successful response for a local/dev environment
            return {
                signedUrl: `/api/upload?fileName=${encodeURIComponent(input.fileName)}&itemId=${input.itemId}`,
                isSimulated: true, // Flag to indicate this is not a real cloud URL
            };
        }),
  
  getItemTypes: protectedProcedure
    .query(async () => {
      // This is a simple query to return the enum values
      const { ItemType } = await import('@prisma/client');
      return Object.values(ItemType);
    }),

    // New procedure to fetch categories
  getCategories: protectedProcedure
    .query(async () => {
        return await prisma.inventoryCategory.findMany({
            orderBy: { name: 'asc' }
        });
    }),
}); 