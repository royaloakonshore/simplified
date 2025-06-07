import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@/lib/auth";

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
});

export const companyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createCompanySchema)
    .mutation(async ({ ctx, input }) => {
      const callingUserId = ctx.session.user.id;

      // 1. Authorization: Only global admins can create companies
      if (ctx.session.user.role !== UserRole.admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to create new companies.",
        });
      }

      // 2. Create the new company
      const newCompany = await prisma.company.create({
        data: {
          name: input.name,
          // Add the creator as a member of the new company
          companyMembers: {
            connect: { id: callingUserId },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // 3. Set the new company as the creator's active company
      await prisma.user.update({
        where: { id: callingUserId },
        data: { activeCompanyId: newCompany.id },
      });
      
      // Note: The client will need to call useSession().update() after this mutation 
      // to refresh the NextAuth session and JWT with the new activeCompanyId.
      return newCompany;
    }),
}); 