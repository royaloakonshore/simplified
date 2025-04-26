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
  // Array for addresses - at least one address might be required depending on logic
  addresses: z.array(addressSchema).min(0), // Start with min 0, can adjust later if needed
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