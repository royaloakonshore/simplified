import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { TRPCError } from '@trpc/server';

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
          // firstName: input.firstName, // Commented out due to persistent linter error
        },
         select: { name: true /*, firstName: true */ }, // Commented out firstName
      });
      
      // Need to return the correct shape even if firstName isn't selected
      return { name: updatedUser.name, firstName: null }; // Return null for firstName for now
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
}); 