import { z } from "zod";
import { createTRPCRouter, companyProtectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { Prisma, type Settings } from "@prisma/client";
import { settingsSchema, type SettingsInput } from "@/lib/schemas/settings.schema";

// Helper to transform Zod input to Prisma Update input
function transformToPrismaUpdateData(input: SettingsInput): Prisma.SettingsUpdateInput {
  const data: Prisma.SettingsUpdateInput = {};
  for (const key in input) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const typedKey = key as keyof SettingsInput;
      const value = input[typedKey];
      // Only include defined values. Prisma handles undefined as "no change".
      // Null values are valid for nullable fields.
      if (value !== undefined) {
        // @ts-expect-error - Prisma types can be overly complex here; direct assignment is fine.
        data[typedKey] = value;
      }
    }
  }
  return data;
}

export const settingsRouter = createTRPCRouter({
  // Get current company's settings
  get: companyProtectedProcedure
    .query(async ({ ctx }) => {
      // Fetch settings for the current company
      const companySettings = await prisma.settings.findFirst({
        where: { companyId: ctx.companyId },
      });
      
      // Return the settings or null if none exist
      return companySettings;
    }),

  // Update company's settings - now acts as an upsert
  update: companyProtectedProcedure
    .input(settingsSchema)
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.companyId;

      // Find existing settings for this company or create new ones
      const existingSettings = await prisma.settings.findFirst({
        where: { companyId },
      });

      if (existingSettings) {
        const updatedSettings = await prisma.settings.update({
          where: { id: existingSettings.id },
          data: input,
        });
        return updatedSettings;
      } else {
        // Create new settings for this company
        const newSettings = await prisma.settings.create({
          data: {
            ...input,
            companyId, // Include the company ID
          },
        });
        return newSettings;
      }
    }),
}); 