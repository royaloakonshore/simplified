import { z } from 'zod';
import { AddressType } from '@prisma/client'; // Import enum from Prisma Client

// Schema for a single address
const addressSchema = z.object({
  id: z.string().optional(), // Optional for creation
  type: z.nativeEnum(AddressType), // Use the imported enum
  streetAddress: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z.string().min(1, 'Country code is required'),
});

// Base schema for customer fields
export const customerBaseSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')), // Allow empty string or valid email
  phone: z.string().optional(),
  vatId: z.string().optional(), // Y-tunnus
  ovtIdentifier: z.string().optional(),
  intermediatorAddress: z.string().optional(),
  addresses: z.array(addressSchema).min(1, "At least one address is required."), // Ensure at least one address
});

// Schema for creating a customer
export const createCustomerSchema = customerBaseSchema;

// Schema for updating a customer (requires ID)
export const updateCustomerSchema = customerBaseSchema.extend({
  id: z.string(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// Schema for customer list filtering and pagination
export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

// Type inference
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;

// Schema for Y-tunnus input validation
export const yTunnusSchema = z.string()
  .regex(/^\d{7}-\d$/, "Invalid Y-tunnus format (e.g., 1234567-8)");

// Schema for the relevant address part from PRH API response
export const prhAddressSchema = z.object({
  street: z.string().optional(),
  postCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(), // PRH API might provide country code
  type: z.string().optional(), // e.g., "Postiosoite" or "Toimitusosoite"
});

// Schema for the selected company info returned by our tRPC route
export const prhCompanyInfoSchema = z.object({
  name: z.string(),
  businessId: z.string(), // The Y-tunnus itself
  vatId: z.string().optional(), // VAT ID, e.g., FI12345678
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional().default("FI"), // Default to Finland
  companyForm: z.string().optional(),
  registrationDate: z.string().optional(), // Date as string
});

export type CustomerFormData = z.infer<typeof customerBaseSchema>; 