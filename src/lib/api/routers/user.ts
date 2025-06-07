import { z } from "zod";
import { createTRPCRouter, protectedProcedure, companyProtectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { TRPCError } from '@trpc/server';
import { UserRole } from "@/lib/auth";

// Schemas from the frontend page (could be moved to a shared schema file)
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(), // Backend determines if required
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(), // Confirmation checked here
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"], 
});

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.user).optional(),
});

export const userRouter = createTRPCRouter({
  // Procedure to update user profile (name, firstName)
  updateProfile: protectedProcedure
    .input(profileUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: input.name,
          firstName: input.firstName,
        },
         select: { name: true, firstName: true },
      });
      
      return { name: updatedUser.name, firstName: updatedUser.firstName };
    }),

  // Procedure to change/set user password
  changePassword: protectedProcedure
    .input(passwordChangeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { hashedPassword: true },
      });

      if (!user) {
         throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }

      // If user already has a password, verify the current one
      if (user.hashedPassword) {
        if (!input.currentPassword) {
           throw new TRPCError({
             code: 'BAD_REQUEST',
             message: 'Current password is required to change existing password.',
           });
        }
        const isValidCurrentPassword = await bcrypt.compare(
          input.currentPassword,
          user.hashedPassword
        );
        if (!isValidCurrentPassword) {
           throw new TRPCError({
             code: 'UNAUTHORIZED',
             message: 'Incorrect current password.',
           });
        }
      }
      // If user is setting password for the first time, currentPassword is not needed (unless enforced)

      // Hash the new password
      const newPasswordHash = await bcrypt.hash(input.newPassword, 10); // Salt rounds = 10

      // Update the user's password hash
      await prisma.user.update({
        where: { id: userId },
        data: { hashedPassword: newPasswordHash },
      });

      return { success: true };
    }),

  // Procedure to get the list of companies the user is a member of
  getMemberCompanies: protectedProcedure
    .output(z.array(z.object({
      id: z.string(),
      name: z.string(),
      // Add other fields like logo or plan if they become part of Company model
    })))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const userWithCompanies = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          memberOfCompanies: {
            select: {
              id: true,
              name: true,
            },
            orderBy: {
              name: 'asc', // Optional: order companies by name
            }
          },
        },
      });

      if (!userWithCompanies) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }
      return userWithCompanies.memberOfCompanies || [];
    }),

  // Procedure to set the user's active company
  setActiveCompany: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .output(z.object({ success: z.boolean(), activeCompanyId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { companyId: targetCompanyId } = input;

      // 1. Verify user is a member of the target company
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          memberOfCompanies: {
            some: {
              id: targetCompanyId,
            },
          },
        },
        select: { id: true }, // Just need to confirm existence
      });

      if (!user) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'User is not a member of the target company or company does not exist.',
        });
      }

      // 2. Update the user's activeCompanyId
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { activeCompanyId: targetCompanyId },
        select: { activeCompanyId: true },
      });
      
      // Note: The client will need to call useSession().update() after this mutation 
      // to refresh the NextAuth session and JWT with the new activeCompanyId.
      return { success: true, activeCompanyId: updatedUser.activeCompanyId };
    }),

  // Procedure to create a new user within the admin's active company
  createUserInActiveCompany: companyProtectedProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { email, name, firstName, role } = input;
      const targetCompanyId = ctx.companyId;

      if (ctx.session.user.role !== UserRole.admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to create users.",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email address already exists.",
        });
      }

      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          firstName,
          role: role || UserRole.user,
          hashedPassword: null,
          activeCompanyId: targetCompanyId,
          memberOfCompanies: {
            connect: { id: targetCompanyId },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          role: true,
          activeCompanyId: true,
        },
      });

      return newUser;
    }),
}); 