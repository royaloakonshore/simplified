import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/lib/api/trpc";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { settingsSchema, type SettingsInput } from "@/lib/schemas/settings.schema"; // Import from schemas

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
      if (value !== undefined) { // Only include defined values (string or null)
        // For Prisma, direct assignment works for string or null to set value or set to null.
        // The StringFieldUpdateOperationsInput is for more complex operations like `increment`.
        // However, to be absolutely safe with the type checker if it insists:
        if (value === null) {
          // @ts-expect-error - Bypassing complex type error for Prisma update data
          data[typedKey] = null; // Direct null is fine for Prisma update data for nullable fields
        } else {
          data[typedKey] = value as any; // Cast to any if direct value causes issues with StringFieldUpdateOperationsInput union
        }
      }
    }
  }
  return data;
}

export const settingsRouter = createTRPCRouter({
  // Get current company's settings
  get: protectedProcedure
    // .input(z.object({ companyId: z.string() })) // companyId will come from context later
    .query(async ({ ctx }) => {
      // For now, assuming a single settings entry or a way to identify it.
      // When proper multi-tenancy with companyId in context is added, use it.
      // const { companyId } = ctx; 
      // This is a placeholder until companyId is available in ctx.
      // For a single-tenant setup or initial phase, we might fetch the first settings record.
      // Or, more realistically, expect a specific ID or a unique constraint that doesn't rely on companyId yet.

      // Placeholder: fetch the first settings record found.
      // IMPORTANT: This needs to be adapted for multi-tenancy (ctx.companyId)
      const settings = await prisma.settings.findFirst(); 
      
      if (!settings) {
        // Return a default empty-like structure or specific null/undefined
        // This helps the frontend form to have initial controlled values.
        return {
            companyName: null,
            companyVatId: null,
            companyOvtIdentifier: null,
            companyStreetAddress: null,
            companyPostalCode: null,
            companyCity: null,
            companyCountryCode: null,
            bankAccountIban: null,
            bankAccountBic: null,
            finvoiceOperatorCode: null,
            finvoiceOperatorName: null,
        } as unknown as Prisma.SettingsGetPayload<{}>; // Cast to satisfy return type if needed
      }
      return settings;
    }),

  // Update/Create company's settings
  update: protectedProcedure
    .input(settingsSchema) // companyId will come from context
    .mutation(async ({ ctx, input }) => {
      // const { companyId } = ctx; // For multi-tenancy
      // IMPORTANT: This needs to be adapted for multi-tenancy (ctx.companyId)
      // For now, we'll try to update the first record, or create if none exists.
      // This is NOT production-ready for multi-tenant scenarios.
      
      const existingSettings = await prisma.settings.findFirst(); // Placeholder
      const prismaUpdateData = transformToPrismaUpdateData(input);

      if (existingSettings) {
        return prisma.settings.update({
          where: { id: existingSettings.id }, 
          data: prismaUpdateData,
        });
      } else {
        // If no settings record exists, create one.
        // companyId is required for create and is @unique in Prisma schema
        // It's not in settingsSchema (input) because it should come from context (multi-tenancy)
        // For now, using a mock value.
        const dataToCreate: Prisma.SettingsCreateInput = {
            ...(prismaUpdateData as any), // Spread transformed data, cast if necessary
            companyId: "mock_company_id", // <<< --- IMPORTANT: REPLACE WITH ACTUAL ctx.companyId
        };
        return prisma.settings.create({
          data: dataToCreate,
        });
      }
    }),
}); 