import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  vatId: z.string().min(1, "VAT ID/Y-tunnus is required"),
  domicile: z.string().min(1, "Domicile/Kotipaikka is required"),
  
  streetAddress: z.string().min(1, "Street address is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  city: z.string().min(1, "City is required"),
  countryCode: z.string().min(1, "Country code is required"),
  countryName: z.string().min(1, "Country name is required"),

  bankAccountIBAN: z.string().min(1, "IBAN is required"),
  bankAccountBIC: z.string().min(1, "BIC is required"),
  
  website: z.string().optional().nullable(),
  sellerIdentifier: z.string().optional().nullable(),
  sellerIntermediatorAddress: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  defaultInvoicePaymentTermsDays: z.coerce.number().int().min(0).optional().nullable(),
  defaultVatRatePercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export type SettingsInput = z.infer<typeof settingsSchema>; 