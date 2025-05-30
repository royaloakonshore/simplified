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
      // For now, assuming a single settings record for the application or a placeholder for companyId.
      // const companyId = ctx.session.user.companyId; // Example for future multi-tenancy
      // if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "No company selected." });
      const settings = await prisma.settings.findFirst(); 
      
      if (!settings) {
        // Return null if no settings are found.
        // The frontend can use this to determine if initial setup is needed.
        return null;
      }
      return settings;
    }),

  // Update company's settings - now acts as an upsert
  update: protectedProcedure
    .input(settingsSchema) // settingsSchema defines all possible fields
    .mutation(async ({ ctx, input }) => {
      // IMPORTANT: This needs to be adapted for multi-tenancy (ctx.companyId)
      // const companyId = ctx.session.user.companyId; // Example for future multi-tenancy
      // if (!companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "No company selected." });

      // For a single-settings model (no companyId yet), we find the first record or create one.
      // If multi-tenancy with companyId on Settings, the upsert would use companyId in `where`.
      
      const existingSettings = await prisma.settings.findFirst(); // In multi-tenant: where: { companyId }

      if (existingSettings) {
        const updatedSettings = await prisma.settings.update({
          where: { id: existingSettings.id }, // In multi-tenant: where: { companyId }
          data: input, // Zod schema ensures `input` is valid SettingsUpdateInput
        });
        return updatedSettings as Settings;
      } else {
        // Create new settings if none exist
        // For multi-tenancy, ensure companyId is part of the create data
        // const createData = { ...input, companyId }; 
        const newSettings = await prisma.settings.create({
          data: input, // Zod schema ensures `input` is valid SettingsCreateInput
        });
        return newSettings as Settings;
      }
    }),
}); 