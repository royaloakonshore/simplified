import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { Prisma, type Settings } from "@prisma/client";
import { settingsSchema, type SettingsInput } from "@/lib/schemas/settings.schema";

// Zod schema for settings - must align with Prisma model
// MOVED to src/lib/schemas/settings.schema.ts
// export const settingsSchema = z.object({ ... });
// export type SettingsInput = z.infer<typeof settingsSchema>;

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
        // @ts-ignore - Prisma types can be overly complex here; direct assignment is fine.
        data[typedKey] = value;
      }
    }
  }
  return data;
}

export const settingsRouter = createTRPCRouter({
  // Get current company's settings
  get: protectedProcedure
    .query(async ({ ctx }) => {
      // IMPORTANT: This needs to be adapted for multi-tenancy (ctx.companyId)
      const settings = await prisma.settings.findFirst(); 
      
      if (!settings) {
        // Return null if no settings are found.
        // The frontend can use this to determine if initial setup is needed.
        return null;
      }
      return settings;
    }),

  // Update company's settings
  update: protectedProcedure
    .input(settingsSchema)
    .mutation(async ({ ctx, input }) => {
      // IMPORTANT: This needs to be adapted for multi-tenancy (ctx.companyId)
      const existingSettings = await prisma.settings.findFirst();
      
      if (!existingSettings) {
        // This should ideally not happen if settings are created during company setup.
        // Or, if using a single global settings record, it implies a setup step was missed.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Settings record not found. Cannot update non-existent settings. Initial setup may be required.",
        });
      }
      
      // The input is already validated by settingsSchema.
      // Prisma will only update fields present in the input.
      const updatedSettings = await prisma.settings.update({
        where: { id: existingSettings.id },
        data: input, // Directly use Zod validated input
      });
      return updatedSettings as Settings;
    }),
}); 