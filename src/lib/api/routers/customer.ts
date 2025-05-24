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
  customerBaseSchema,
  listCustomersSchema,
  yTunnusSchema,
  prhCompanyInfoSchema,
} from "@/lib/schemas/customer.schema";
import type { Address } from '@prisma/client';
import { AddressType } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

// Define a type for the PRH API address structure for better type safety internally
interface PRHApiAddress {
  street?: string;
  postCode?: string;
  city?: string;
  country?: string; // Typically a country code like 'FI'
  type?: string;    // e.g., "Postiosoite", "Toimitusosoite"
  language?: string;
  registrationDate?: string;
  endDate?: string;
  careOf?: string;
}

// Define a type for the expected PRH API response structure (subset)
interface PRHApiResponse {
  name: string;
  businessId: string;
  vatNumber?: string; // This field is directly available in the PRH API if VAT registered
  addresses?: PRHApiAddress[];
  companyForm?: string;
  registrationDate?: string;
  // ... other fields we might not directly use but are present
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

  getYTunnusInfo: protectedProcedure
    .input(z.object({ yTunnus: yTunnusSchema }))
    .output(prhCompanyInfoSchema)
    .query(async ({ input }) => {
      const { yTunnus } = input;
      const apiUrl = `https://avoindata.prh.fi/bis/v1/${yTunnus}`;

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
            message: `Failed to fetch data from PRH API. Status: ${response.status}`,
          });
        }

        const apiDataArray = await response.json() as unknown as { results: PRHApiResponse[] };
        
        if (!apiDataArray.results || !Array.isArray(apiDataArray.results) || apiDataArray.results.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No company data found in PRH API response for Y-tunnus: ${yTunnus}`,
          });
        }

        const companyData = apiDataArray.results[0];

        if (!companyData) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: `No company data found for Y-tunnus: ${yTunnus}`,
            });
        }

        let streetAddress: string | undefined;
        let postalCode: string | undefined;
        let city: string | undefined;
        let countryCode: string | undefined = "FI";

        if (companyData.addresses && companyData.addresses.length > 0) {
          let postalApiAddress = companyData.addresses.find(addr => addr.type === "Postiosoite");
          if (!postalApiAddress && companyData.addresses.length > 0) {
            postalApiAddress = companyData.addresses[0];
          }

          if (postalApiAddress) {
            streetAddress = postalApiAddress.street;
            postalCode = postalApiAddress.postCode;
            city = postalApiAddress.city;
            if (postalApiAddress.country && postalApiAddress.country.trim() !== "") {
                countryCode = postalApiAddress.country.toUpperCase();
            }
          }
        }
        
        let vatId = companyData.vatNumber;
        if (!vatId && companyData.businessId && /^\d{7}-\d$/.test(companyData.businessId)) {
            vatId = `FI${companyData.businessId.replace("-", "")}`;
        }

        return {
          name: companyData.name,
          businessId: companyData.businessId,
          vatId: vatId,
          streetAddress,
          postalCode,
          city,
          countryCode,
          companyForm: companyData.companyForm,
          registrationDate: companyData.registrationDate,
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
    .query(async ({ ctx, input }) => {
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
    .query(async ({ ctx, input }) => {
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
}); 