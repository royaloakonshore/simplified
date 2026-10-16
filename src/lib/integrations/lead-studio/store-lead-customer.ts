import { AddressType, Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  nextCustomerNumber,
  pickReusableCustomer,
  type LeadIntakeStore,
  type ParsedLeadCustomer,
  type ReusableCustomerRow,
} from "@/lib/integrations/lead-studio/intake-customer";

const customerSelect = {
  id: true,
  customerNumber: true,
  email: true,
  vatId: true,
  buyerReference: true,
} as const;

function reuseWhere(companyId: string, lead: ParsedLeadCustomer): Prisma.CustomerWhereInput | null {
  const or: Prisma.CustomerWhereInput[] = [];
  if (lead.buyerReference) {
    or.push({ buyerReference: lead.buyerReference });
  }
  if (lead.email) {
    or.push({ email: { equals: lead.email, mode: "insensitive" } });
  }
  for (const vatId of lead.vatLookup) {
    or.push({ vatId: { equals: vatId, mode: "insensitive" } });
  }
  if (or.length === 0) {
    return null;
  }
  return { companyId, OR: or };
}

async function findReusable(
  db: Prisma.TransactionClient,
  companyId: string,
  lead: ParsedLeadCustomer,
): Promise<ReusableCustomerRow | null> {
  const where = reuseWhere(companyId, lead);
  if (!where) {
    return null;
  }
  const rows = await db.customer.findMany({
    where,
    select: customerSelect,
    take: 10,
  });
  return pickReusableCustomer(rows, lead);
}

async function allocateCustomerNumber(db: Prisma.TransactionClient): Promise<string> {
  const last = await db.customer.findFirst({
    where: { customerNumber: { not: null } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  return nextCustomerNumber(last?.customerNumber);
}

export function prismaLeadIntakeStore(db: PrismaClient = prisma): LeadIntakeStore {
  return {
    findCompanyById(id) {
      return db.company.findUnique({
        where: { id },
        select: { id: true, name: true, businessId: true },
      });
    },
    listCompanies(take) {
      return db.company.findMany({
        select: { id: true, name: true, businessId: true },
        orderBy: { createdAt: "asc" },
        take,
      });
    },
    async save(companyId, lead) {
      return db.$transaction(async (tx) => {
        const existing = await findReusable(tx, companyId, lead);
        if (existing) {
          return {
            created: false,
            id: existing.id,
            customerNumber: existing.customerNumber,
          };
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const created = await tx.customer.create({
              data: {
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                vatId: lead.vatId,
                language: lead.language,
                buyerReference: lead.buyerReference,
                customerNumber: await allocateCustomerNumber(tx),
                companyId,
                addresses: lead.billingAddress
                  ? {
                      create: [
                        {
                          type: AddressType.billing,
                          streetAddress: lead.billingAddress.streetAddress,
                          city: lead.billingAddress.city,
                          postalCode: lead.billingAddress.postalCode,
                          countryCode: lead.billingAddress.countryCode,
                        },
                      ],
                    }
                  : undefined,
              },
              select: { id: true, customerNumber: true },
            });
            return {
              created: true,
              id: created.id,
              customerNumber: created.customerNumber,
            };
          } catch (error) {
            if (
              attempt === 0 &&
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              const raced = await findReusable(tx, companyId, lead);
              if (raced) {
                return {
                  created: false,
                  id: raced.id,
                  customerNumber: raced.customerNumber,
                };
              }
              continue;
            }
            throw error;
          }
        }

        throw new Error("Customer number could not be reserved.");
      });
    },
  };
}
