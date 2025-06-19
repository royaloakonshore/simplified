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
    .query(async ({ input }) => {
      return await prisma.customer.findUnique({
        where: { id: input.id },
        include: { addresses: true }, // Include addresses by default
      });
    }),

  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ input }) => {
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
    .mutation(async ({ input }) => {
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

  getOrders: protectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      // Optional: Add pagination/filtering params here if needed later
      // limit: z.number().min(1).max(100).optional().default(10),
      // cursor: z.string().cuid().optional(), 
    }))
    .query(async ({ input }) => {
      const { customerId } = input;
      // TODO: Add companyId filter: companyId: ctx.companyId
      const orders = await prisma.order.findMany({
        where: {
          customerId: customerId,
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

  getInvoices: protectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      // Optional: Add pagination/filtering params here if needed later
    }))
    .query(async ({ input }) => {
      const { customerId } = input;
      // TODO: Add companyId filter: companyId: ctx.companyId
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: customerId,
        },
        orderBy: { invoiceDate: 'desc' },
        // Minimal include for invoice history list
        include: {
          items: { select: { id: true } } // Just to get a count or basic info if needed
        }
      });
      return invoices.map(invoice => ({ ...invoice, itemCount: invoice.items.length }));
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
        totalRevenue: revenueAggregate._sum.totalAmount?.toNumber() || 0,
        paidInvoiceCount: revenueAggregate._count.id || 0,
        lastInvoiceDate: latestInvoice?.invoiceDate || null,
        lastInvoiceStatus: latestInvoice?.status || null,
      };
    }),

  updateFinvoiceDetails: protectedProcedure
    .input(z.object({
      customerId: z.string().cuid(),
      ovt: z.string(),
      intermediator: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { customerId, ovt, intermediator } = input;

      await prisma.customer.update({
        where: { id: customerId },
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