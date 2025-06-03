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
  inventoryItemBaseSchema,
  type InventoryItemFormValues,
  listInventoryItemsSchema,
} from "@/lib/schemas/inventory.schema";
import { TransactionType, Prisma, ItemType } from '@prisma/client'; // Import enum and Prisma for Decimal
import { TRPCError } from '@trpc/server';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

export const inventoryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listInventoryItemsSchema)
    .query(async ({ ctx, input }) => {
      const sessionCompanyId = ctx.session.user.companyId;
      const inputCompanyId = input.companyId;

      const filterCompanyId = inputCompanyId || sessionCompanyId;

      if (!filterCompanyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Company ID is required to list inventory items. User may not be associated with a company.',
        });
      }

      const { search, itemType, inventoryCategoryId, sortBy, sortDirection, page = 1, perPage = 10 } = input;

      const whereClause: Prisma.InventoryItemWhereInput = {
        companyId: filterCompanyId,
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

      const orderBy: Prisma.InventoryItemOrderByWithRelationInput = { [sortBy]: sortDirection };
      
      const skip = (page - 1) * perPage;
      const take = perPage;

      const [itemsFromDb, totalCount] = await prisma.$transaction([
        prisma.inventoryItem.findMany({
          take,
          skip,
          orderBy,
          where: whereClause,
          include: { 
            inventoryCategory: { select: { name: true, id: true} },
          }
        }),
        prisma.inventoryItem.count({ where: whereClause })
      ]);
      
      const itemsWithQuantity = await Promise.all(
        itemsFromDb.map(async (item) => {
          const transactions = await prisma.inventoryTransaction.aggregate({
            _sum: { quantity: true },
            where: { itemId: item.id },
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
        })
      );

      return {
        data: itemsWithQuantity,
        meta: {
            totalCount,
            page,
            perPage,
            totalPages: Math.ceil(totalCount / perPage),
        }
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: input.id },
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
    .mutation(async ({ ctx, input }) => {
      const { itemData, initialStockQuantity } = input;
      const userId = ctx.session.user.id;

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
    .mutation(async ({ ctx, input }) => {
      const { itemData, stockAdjustment, adjustmentNote } = input;
      const { id, ...dataToUpdate } = itemData;
      const userId = ctx.session.user.id;

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
              // userId: userId, // If tracking user for transaction
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

  create: protectedProcedure
    .input(createInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { quantityOnHand, ...itemData } = input;
      const userId = ctx.session.user.id;

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

  update: protectedProcedure
    .input(updateInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, quantityOnHand, ...dataToUpdate } = input;
      const userId = ctx.session.user.id;

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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const relatedOrderItems = await prisma.orderItem.count({ where: { inventoryItemId: input.id }});
        const relatedInvoiceItems = await prisma.invoiceItem.count({ where: { inventoryItemId: input.id }});
        const relatedBomComponentItems = await prisma.billOfMaterialItem.count({ 
          where: { componentItemId: input.id } 
        });
        const isManufacturedItemForBOM = await prisma.billOfMaterial.count({ 
          where: { manufacturedItemId: input.id } 
        });

        if (relatedOrderItems > 0 || relatedInvoiceItems > 0 || relatedBomComponentItems > 0 || isManufacturedItemForBOM > 0) {
            let message = 'Cannot delete item. It is referenced in:';
            if (relatedOrderItems > 0) message += ' existing orders,';
            if (relatedInvoiceItems > 0) message += ' existing invoices,';
            if (relatedBomComponentItems > 0 || isManufacturedItemForBOM > 0) message += ' existing Bill of Materials,';
            message = message.slice(0, -1) + '.';
            throw new TRPCError({
                code: 'CONFLICT',
                message,
            });
        }

        await prisma.inventoryTransaction.deleteMany({ where: { itemId: input.id }});
        return await prisma.inventoryItem.delete({ where: { id: input.id } });
      } catch (error) {
         if (error instanceof TRPCError) throw error;
         throw new TRPCError({
           code: 'INTERNAL_SERVER_ERROR',
           message: 'Failed to delete inventory item.',
         });
      }
    }),

   adjustStock: protectedProcedure
    .input(adjustStockSchema)
    .mutation(async ({ input }) => {
      const { itemId, quantityChange, note } = input;
      const item = await prisma.inventoryItem.findUnique({ 
        where: { id: itemId },
      });
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Item to adjust not found.' });
      }

      return prisma.$transaction(async (tx) => {
        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: itemId,
            quantity: new Prisma.Decimal(quantityChange),
            type: TransactionType.adjustment, 
            note: note,
          },
        });

        const allTransactions = await tx.inventoryTransaction.aggregate({
          _sum: { quantity: true },
          where: { itemId: itemId },
        });
        const newActualQOH = allTransactions._sum.quantity ?? new Prisma.Decimal(0);
        await tx.inventoryItem.update({
          where: { id: itemId },
          data: { quantityOnHand: newActualQOH }
        });

        return transaction;
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
        pdfBase64: (pdfBuffer as any).toString('base64'),
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

  getReplenishmentAlerts: protectedProcedure
    .query(async ({ ctx }) => {
      const items = await prisma.inventoryItem.findMany({
        where: {
          OR: [
            {
              quantityOnHand: { lt: prisma.inventoryItem.fields.reorderLevel },
              reorderLevel: { not: null },
            },
            {
              quantityOnHand: { lt: prisma.inventoryItem.fields.minimumStockLevel },
            },
          ],
        },
        orderBy: [
          { itemType: 'asc' }, 
          { name: 'asc' },
        ],
      });

      // Convert Decimal fields to strings for client
      return items.map(item => ({
        ...item,
        quantityOnHand: item.quantityOnHand.toString(),
        reorderLevel: item.reorderLevel?.toString() ?? null,
        minimumStockLevel: item.minimumStockLevel.toString(),
        // leadTimeDays, vendorSku, vendorItemName, unitOfMeasure will be on item directly
      }));
    }),
}); 