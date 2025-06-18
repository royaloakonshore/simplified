import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, companyProtectedProcedure } from "@/lib/api/trpc";
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
  upsert: companyProtectedProcedure
    .input(UpsertBillOfMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, name, description, manualLaborCost, manufacturedItemId, items } = input;
      const companyId = ctx.companyId; // Use company ID from context

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
          const existingByName = await prisma.billOfMaterial.findFirst({ where: { name, companyId } });
          if (existingByName) throw new TRPCError({ code: 'CONFLICT', message: `BOM name "${name}" already exists.` });
          
          // Check manufacturedItemId conflict only if it's not null and not undefined
          if (createDataInitial.manufacturedItemId) { 
            const existingByMfgItem = await prisma.billOfMaterial.findFirst({ 
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

  get: companyProtectedProcedure
    .input(GetBillOfMaterialSchema)
    .query(async ({ ctx, input }) => {
      const companyId = ctx.companyId; // Use company ID from context

      const bom = await prisma.billOfMaterial.findUnique({
        where: { id: input.id, companyId }, // Enforce companyId in the where clause
        include: {
          items: {
            include: {
              componentItem: { select: { id: true, name: true, sku: true, unitOfMeasure: true, variant: true, inventoryCategory: { select: { name: true }} } }, // Include necessary fields for RawMaterialRow
            },
          },
          manufacturedItem: { select: { id: true, name: true, sku: true } },
          company: { select: { id: true, name: true } },
        },
      });

      if (!bom) {
        // Note: The findUnique with id AND companyId already scopes it. 
        // If not found, it's either wrong ID or wrong company.
        throw new TRPCError({ code: 'NOT_FOUND', message: `Bill of Material with ID ${input.id} not found or not accessible for this company.` });
      }
      
      // Ensure Decimal fields are converted to numbers or strings for the client if necessary for BOMForm
      // Prisma returns Decimal objects for Decimal fields.
      // The BOMFormProps expects manualLaborCost as number and item quantities as numbers.
      return {
        ...bom,
        manualLaborCost: bom.manualLaborCost.toNumber(),
        items: bom.items.map(item => ({
          ...item,
          quantity: item.quantity.toNumber(),
          // componentItem already has string/null fields from select query
        })),
      };
    }),

  list: companyProtectedProcedure
    .input(ListBillOfMaterialsSchema.omit({ companyId: true })) // Remove companyId from input since it comes from context
    .query(async ({ ctx, input }) => {
      const companyId = ctx.companyId; // Use company ID from context

      const whereClause: Prisma.BillOfMaterialWhereInput = {
        companyId,
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
            manufacturedItem: { 
              select: { 
                id: true, 
                name: true, 
                sku: true,
                inventoryCategory: { select: { id: true, name: true } }
              } 
            },
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

  delete: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId; // Use company ID from context
      
      // First, ensure the BOM exists and belongs to the company
      const bomToDelete = await prisma.billOfMaterial.findUnique({
        where: { id: input.id, companyId }
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

  exportPDF: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId;

      // Get the BOM data with all necessary information
      const bom = await prisma.billOfMaterial.findUnique({
        where: { id: input.id, companyId },
        include: {
          items: {
            include: {
              componentItem: { 
                select: { 
                  id: true, 
                  name: true, 
                  sku: true, 
                  unitOfMeasure: true, 
                  variant: true, 
                  costPrice: true,
                  inventoryCategory: { select: { name: true } } 
                } 
              },
            },
          },
          manufacturedItem: { select: { id: true, name: true, sku: true } },
          company: { select: { id: true, name: true } },
        },
      });

      if (!bom) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'BOM not found or not accessible for this company.' });
      }

             try {
         const puppeteer = await import('puppeteer');
         const browser = await puppeteer.default.launch({ headless: true });
         const page = await browser.newPage();

        // Calculate total component cost
        const totalComponentCost = bom.items.reduce((total, item) => {
          const componentCost = item.componentItem.costPrice ? item.componentItem.costPrice.toNumber() : 0;
          const itemQuantity = item.quantity.toNumber();
          return total + (componentCost * itemQuantity);
        }, 0);

        // Generate HTML content for the BOM PDF
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Bill of Materials - ${bom.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                color: #333; 
                line-height: 1.6;
              }
              .header { 
                text-align: center; 
                margin-bottom: 40px; 
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 20px;
              }
              .company-name { 
                font-size: 24px; 
                font-weight: bold; 
                color: #1f2937; 
                margin-bottom: 10px;
              }
              .bom-title { 
                font-size: 32px; 
                font-weight: bold; 
                color: #1f2937; 
                margin-bottom: 10px;
              }
              .bom-name { 
                font-size: 18px; 
                color: #6b7280; 
                margin-bottom: 20px;
              }
              .info-section {
                margin-bottom: 30px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
              }
              .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
              }
              .info-item {
                margin-bottom: 10px;
              }
              .info-label {
                font-weight: bold;
                color: #374151;
                display: block;
                margin-bottom: 5px;
              }
              .info-value {
                color: #1f2937;
              }
              .manufactured-item {
                background: #dbeafe;
                padding: 10px;
                border-radius: 6px;
                display: inline-block;
              }
              .components-section {
                margin-bottom: 30px;
              }
              .section-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #1f2937;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 10px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 30px;
                font-size: 14px;
              }
              th, td { 
                border: 1px solid #e5e7eb; 
                padding: 12px 8px; 
                text-align: left; 
              }
              th { 
                background-color: #f3f4f6; 
                font-weight: bold;
                color: #374151;
              }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .cost-section {
                background: #f0f9ff;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #bae6fd;
              }
              .cost-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                text-align: center;
              }
              .cost-item {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
              }
              .cost-label {
                font-size: 12px;
                color: #6b7280;
                margin-bottom: 5px;
              }
              .cost-value {
                font-size: 20px;
                font-weight: bold;
                color: #1f2937;
              }
              .total-cost {
                background: #ecfdf5 !important;
                border-color: #a7f3d0 !important;
              }
              .badge {
                background: #e5e7eb;
                color: #374151;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
                         <div class="header">
               <div class="company-name">${bom.company?.name || 'Company Name'}</div>
               <div class="bom-title">Bill of Materials</div>
               <div class="bom-name">${bom.name}</div>
             </div>

            <div class="info-section">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">BOM Name:</span>
                  <span class="info-value">${bom.name}</span>
                </div>
                ${bom.description ? `
                <div class="info-item">
                  <span class="info-label">Description:</span>
                  <span class="info-value">${bom.description}</span>
                </div>
                ` : ''}
              </div>
              ${bom.manufacturedItem ? `
              <div class="info-item" style="margin-top: 15px;">
                <span class="info-label">Manufactured Item:</span>
                <div class="manufactured-item">
                  <strong>${bom.manufacturedItem.name}</strong>
                  ${bom.manufacturedItem.sku ? ` (${bom.manufacturedItem.sku})` : ''}
                </div>
              </div>
              ` : ''}
            </div>

            <div class="components-section">
              <div class="section-title">Required Components</div>
              ${bom.items.length === 0 ? `
                <p style="text-align: center; color: #6b7280; padding: 40px;">
                  No components defined for this BOM.
                </p>
              ` : `
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Component Name</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th class="text-right">Quantity Required</th>
                      <th>Variant</th>
                      <th class="text-right">Unit Cost</th>
                      <th class="text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${bom.items.map(item => {
                      const quantity = item.quantity.toNumber();
                      const unitCost = item.componentItem.costPrice ? item.componentItem.costPrice.toNumber() : 0;
                      const totalCost = quantity * unitCost;
                      return `
                        <tr>
                          <td style="font-family: monospace;">${item.componentItem.sku || 'N/A'}</td>
                          <td><strong>${item.componentItem.name}</strong></td>
                          <td>${item.componentItem.inventoryCategory?.name ? `<span class="badge">${item.componentItem.inventoryCategory.name}</span>` : 'N/A'}</td>
                          <td>${item.componentItem.unitOfMeasure || 'N/A'}</td>
                          <td class="text-right"><strong>${quantity}</strong></td>
                          <td>${item.componentItem.variant ? `<span class="badge">${item.componentItem.variant}</span>` : 'N/A'}</td>
                          <td class="text-right">€${unitCost.toFixed(2)}</td>
                          <td class="text-right"><strong>€${totalCost.toFixed(2)}</strong></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <div class="cost-section">
              <div class="section-title">Cost Breakdown</div>
              <div class="cost-grid">
                <div class="cost-item">
                  <div class="cost-label">Components Cost</div>
                  <div class="cost-value">€${totalComponentCost.toFixed(2)}</div>
                </div>
                <div class="cost-item">
                  <div class="cost-label">Manual Labor Cost</div>
                  <div class="cost-value">€${bom.manualLaborCost.toNumber().toFixed(2)}</div>
                </div>
                <div class="cost-item total-cost">
                  <div class="cost-label">Total Calculated Cost</div>
                  <div class="cost-value">€${bom.totalCalculatedCost.toNumber().toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
          </body>
          </html>
        `;

        await page.setContent(htmlContent);
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        });

        await browser.close();

        return {
          success: true,
          pdfBase64: (pdfBuffer as Buffer).toString('base64'),
          message: `BOM PDF generated successfully for ${bom.name}`,
          filename: `BOM-${bom.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`
        };

      } catch (error) {
        console.error('Error generating BOM PDF:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate BOM PDF',
          cause: error,
        });
      }
    }),
}); 