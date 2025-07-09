import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createTRPCRouter,
  protectedProcedure,
  companyProtectedProcedure,
} from "@/lib/api/trpc";
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  yTunnusSchema,
  prhCompanyInfoSchema,
} from "@/lib/schemas/customer.schema";
import type { Address } from '@prisma/client';
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

// Define types for the actual PRH API response structure (opendata-registerednotices-api/v3)
interface PRHApiAddress {
  type: number; // 1 = postal address, 2 = business address  
  street?: string;
  postCode?: string;
  postOffices?: Array<{
    city: string;
    languageCode: string;
    municipalityCode: string;
  }>;
  buildingNumber?: string;
  co?: string; // Care of
  registrationDate?: string;
  source?: string;
}

interface PRHApiName {
  name: string;
  type: string;
  registrationDate: string;
  endDate?: string;
  version: number;
  source: string;
}

interface PRHApiCompanyForm {
  type: string;
  descriptions: Array<{
    languageCode: string;
    description: string;
  }>;
  registrationDate: string;
  version: number;
  source: string;
}

interface PRHApiRegisteredEntry {
  type: string;
  descriptions: Array<{
    languageCode: string;
    description: string;
  }>;
  registrationDate: string;
  endDate?: string;
  register?: string;
  authority?: string;
}

// Actual PRH API response structure
interface PRHApiResponse {
  businessId: {
    value: string;
    registrationDate: string;
    source: string;
  };
  names: PRHApiName[];
  addresses?: PRHApiAddress[];
  companyForms?: PRHApiCompanyForm[];
  registeredEntries?: PRHApiRegisteredEntry[];
  registrationDate?: string;
}

export const customerRouter = createTRPCRouter({
  list: companyProtectedProcedure
    .input(listCustomersSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, search, sortBy, sortDirection } = input;

      const whereClause: Prisma.CustomerWhereInput = {
        companyId: ctx.companyId, // Ensure company scoping
      };
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const skip = (page - 1) * perPage;

      const items = await ctx.db.customer.findMany({
        skip: skip,
        take: perPage,
        where: whereClause,
        orderBy: {
          [sortBy]: sortDirection,
        },
      });

      const totalCount = await ctx.db.customer.count({
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

  getById: companyProtectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUnique({
        where: { id: input.id, companyId: ctx.companyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          vatId: true,
          language: true,
          ovtIdentifier: true,
          intermediatorAddress: true,
          buyerReference: true,
          customerNumber: true,
          addresses: true,
        },
      });
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found." });
      }
      return customer;
    }),

  create: companyProtectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { addresses, ...customerInput } = input;

      // Use Prisma transaction to create customer and addresses together
      return await prisma.$transaction(async (tx) => {
        // Generate customer number if not provided
        let customerNumber = customerInput.customerNumber;
        if (!customerNumber) {
          // Get the next customer number
          const lastCustomer = await tx.customer.findFirst({
            where: {
              companyId: ctx.companyId,
              customerNumber: {
                not: null,
              },
            },
            orderBy: {
              customerNumber: 'desc',
            },
            select: {
              customerNumber: true,
            },
          });

          if (!lastCustomer || !lastCustomer.customerNumber) {
            customerNumber = "010";
          } else {
            try {
              const lastNumber = parseInt(lastCustomer.customerNumber, 10);
              if (isNaN(lastNumber)) {
                customerNumber = "010"; 
              } else {
                const nextNumber = lastNumber + 1;
                customerNumber = nextNumber.toString().padStart(3, '0');
              }
            } catch (e) {
              customerNumber = "010";
            }
          }
        }

        const customerData = {
          ...customerInput,
          customerNumber,
          companyId: ctx.companyId,
          language: customerInput.language === null ? undefined : customerInput.language,
        };

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

  update: companyProtectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, addresses, ...customerInput } = input;

      const customerData = {
        ...customerInput,
        language: customerInput.language === null ? undefined : customerInput.language,
      };

      // Use Prisma transaction for update
      return await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.update({
          where: { 
            id,
            companyId: ctx.companyId // Ensure company scoping
          },
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
    .mutation(async ({ input }) => {
      // Prisma schema uses onDelete: Cascade for Address, so they'll be deleted too
      // Need to consider related Orders/Invoices - what should happen?
      // For now, simple delete. Add checks/logic later if needed.
      return await prisma.customer.delete({
        where: { id: input.id },
      });
    }),

  getYTunnusInfo: protectedProcedure
    .input(z.object({ yTunnus: yTunnusSchema }))
    .output(prhCompanyInfoSchema)
    .query(async ({ input }) => {
      const { yTunnus } = input;
      // Correct PRH API endpoint - using the registered notices API
      const apiUrl = `https://avoindata.prh.fi/opendata-registerednotices-api/v3/${yTunnus}`;

      try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
          if (response.status === 404) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `No company found with Y-tunnus: ${yTunnus}`,
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `PRH API service temporarily unavailable. Please try again later. (Status: ${response.status})`,
          });
        }

        const responseText = await response.text();
        
        // Check if response is HTML (service interruption) instead of JSON
        if (responseText.includes('<!doctype html>') || responseText.includes('<html')) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "PRH API is currently under maintenance. Please try again later.",
          });
        }

        let companyData: PRHApiResponse;
        try {
          // PRH API returns company data directly (not wrapped in results array)
          companyData = JSON.parse(responseText) as PRHApiResponse;
        } catch (parseError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid response format from PRH API. Service may be temporarily unavailable.",
          });
        }
        
        if (!companyData.businessId || !companyData.names || companyData.names.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No company data found in PRH API response for Y-tunnus: ${yTunnus}`,
          });
        }

        // Extract company information
        let streetAddress: string | undefined;
        let postalCode: string | undefined;
        let city: string | undefined;
        const countryCode: string | undefined = "FI";

        // Find postal address (type 1) or fallback to first available address
        if (companyData.addresses && companyData.addresses.length > 0) {
          let postalApiAddress = companyData.addresses.find(addr => addr.type === 1); // 1 = postal address
          if (!postalApiAddress && companyData.addresses.length > 0) {
            postalApiAddress = companyData.addresses[0];
          }

          if (postalApiAddress) {
            streetAddress = postalApiAddress.street;
            if (postalApiAddress.buildingNumber) {
              streetAddress = streetAddress ? `${streetAddress} ${postalApiAddress.buildingNumber}` : postalApiAddress.buildingNumber;
            }
            postalCode = postalApiAddress.postCode;
            
            // Get city from postOffices array (prefer Finnish language code "1")
            if (postalApiAddress.postOffices && postalApiAddress.postOffices.length > 0) {
              const finnishCity = postalApiAddress.postOffices.find(po => po.languageCode === "1");
              city = finnishCity ? finnishCity.city : postalApiAddress.postOffices[0].city;
            }
          }
        }
        
        // Get the most recent company name (highest version or most recent registration date)
        let companyName = companyData.names[0].name;
        if (companyData.names.length > 1) {
          const sortedNames = companyData.names
            .filter(n => !n.endDate) // Only active names
            .sort((a, b) => b.version - a.version || new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
          if (sortedNames.length > 0) {
            companyName = sortedNames[0].name;
          }
        }

        // Generate VAT ID from business ID (Finnish format: FI + businessId without hyphen)
        const businessId = companyData.businessId.value;
        let vatId: string | undefined;
        if (businessId && /^\d{7}-\d$/.test(businessId)) {
          vatId = `FI${businessId.replace("-", "")}`;
        }

        // Get company form (prefer Finnish description)
        let companyForm: string | undefined;
        if (companyData.companyForms && companyData.companyForms.length > 0) {
          const finnishForm = companyData.companyForms[0].descriptions.find(d => d.languageCode === "1");
          companyForm = finnishForm ? finnishForm.description : companyData.companyForms[0].descriptions[0].description;
        }

        return {
          name: companyName,
          businessId: businessId,
          vatId: vatId,
          streetAddress,
          postalCode,
          city,
          countryCode,
          companyForm,
          registrationDate: companyData.businessId.registrationDate,
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Error in getYTunnusInfo:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while fetching company information.",
          cause: error,
        });
      }
    }),

  getOrders: companyProtectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      // Optional: Add pagination/filtering params here if needed later
    }))
    .query(async ({ input, ctx }) => {
      const { customerId } = input;
      const orders = await prisma.order.findMany({
        where: {
          customerId: customerId,
          companyId: ctx.companyId,
        },
        orderBy: { orderDate: 'desc' }, 
        // Minimal include for order history list
        include: {
          // customer: { select: { name: true } }, // Customer name already known from context
          items: { select: { id: true } } // Just to get a count or basic info if needed
        }
      });
      return orders.map(order => ({ ...order, itemCount: order.items.length }));
    }),

  getInvoices: companyProtectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      // Optional: Add pagination/filtering params here if needed later
    }))
    .query(async ({ input, ctx }) => {
      const { customerId } = input;
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: customerId,
          companyId: ctx.companyId,
        },
        orderBy: { invoiceDate: 'desc' },
        // Minimal include for invoice history list
        include: {
          items: { select: { id: true } } // Just to get a count or basic info if needed
        }
      });
      return invoices.map(invoice => ({ ...invoice, itemCount: invoice.items.length }));
    }),

  getMarginData: companyProtectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      months: z.number().default(12),
    }))
    .query(async ({ input, ctx }) => {
      const { customerId, months } = input;
      
      // Calculate date range (last X months)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      
      // Get all SENT invoices (not credited) for this customer in the date range
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: customerId,
          companyId: ctx.companyId,
          status: 'sent', // Only include sent invoices as specified
          invoiceDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: {
                  bom: {
                    include: {
                      items: {
                        include: {
                          componentItem: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (invoices.length === 0) {
        return {
          customerId,
          totalRevenue: 0,
          totalMargin: 0,
          marginPercentage: 0,
          invoiceCount: 0,
          period: `Last ${months} months`,
        };
      }

      let totalRevenue = 0;
      let totalCost = 0;

      // Calculate margin for each invoice
      for (const invoice of invoices) {
        // Add invoice total (after all discounts) to revenue
        const invoiceRevenue = invoice.totalAmount ? Number(invoice.totalAmount.toString()) : 0;
        totalRevenue += invoiceRevenue;

        // Calculate cost for each line item
        for (const item of invoice.items) {
          const quantity = Number(item.quantity.toString());
          let unitCost = 0;

          if (item.inventoryItem.itemType === 'RAW_MATERIAL') {
            unitCost = Number(item.inventoryItem.costPrice.toString());
          } else if (item.inventoryItem.itemType === 'MANUFACTURED_GOOD' && item.inventoryItem.bom) {
            // Add manual labor cost
            if (item.inventoryItem.bom.manualLaborCost) {
              unitCost += Number(item.inventoryItem.bom.manualLaborCost.toString());
            }
            
            // Add BOM component costs
            for (const bomItem of item.inventoryItem.bom.items) {
              const componentCost = Number(bomItem.componentItem.costPrice.toString());
              const componentQuantity = Number(bomItem.quantity.toString());
              unitCost += componentCost * componentQuantity;
            }
          } else {
            // Fallback to cost price
            unitCost = Number(item.inventoryItem.costPrice.toString());
          }

          totalCost += unitCost * quantity;
        }
      }

      const totalMargin = totalRevenue - totalCost;
      const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

      return {
        customerId,
        totalRevenue,
        totalMargin,
        marginPercentage,
        invoiceCount: invoices.length,
        period: `Last ${months} months`,
      };
    }),

  getRevenue: companyProtectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { customerId } = input;
      const { companyId } = ctx;
      
      // Calculate lifetime revenue from paid invoices
      const revenueAggregate = await prisma.invoice.aggregate({
        where: {
          customerId: customerId,
          companyId: companyId,
          status: "paid",
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      // Get latest invoice to check customer activity
      const latestInvoice = await prisma.invoice.findFirst({
        where: {
          customerId: customerId,
          companyId: companyId,
        },
        orderBy: {
          invoiceDate: 'desc',
        },
        select: {
          invoiceDate: true,
          status: true,
        },
      });

      return {
        totalRevenue: revenueAggregate._sum.totalAmount ? Number(revenueAggregate._sum.totalAmount.toString()) : 0,
        paidInvoiceCount: revenueAggregate._count.id || 0,
        lastInvoiceDate: latestInvoice?.invoiceDate || null,
        lastInvoiceStatus: latestInvoice?.status || null,
      };
    }),

  getNextCustomerNumber: companyProtectedProcedure
    .query(async ({ ctx }) => {
      const lastCustomer = await ctx.db.customer.findFirst({
        where: {
          companyId: ctx.companyId,
          customerNumber: {
            not: null,
          },
        },
        orderBy: {
          customerNumber: 'desc',
        },
        select: {
          customerNumber: true,
        },
      });

      if (!lastCustomer || !lastCustomer.customerNumber) {
        return "010";
      }

      try {
        const lastNumber = parseInt(lastCustomer.customerNumber, 10);
        if (isNaN(lastNumber)) {
          // Handle cases where an existing customerNumber is not a valid number
          return "010"; 
        }
        const nextNumber = lastNumber + 1;
        return nextNumber.toString().padStart(3, '0');
      } catch (e) {
        // Fallback in case of parsing errors
        return "010";
      }
    }),

  updateFinvoiceDetails: companyProtectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      ovt: z.string(),
      intermediator: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { customerId, ovt, intermediator } = input;

      await ctx.db.customer.update({
        where: { id: customerId, companyId: ctx.companyId },
        data: {
          ovtIdentifier: ovt,
          intermediatorAddress: intermediator,
        },
      });

      return { success: true, message: 'Finvoice details updated.' };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ input }) => {
      const { query } = input;
      // TODO: Add companyId scoping
      return await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      });
    }),
}); 