import { z } from 'zod';
import { AddressType } from '../types/customer.types';

// Schema for address validation
export const addressSchema = z.object({
  id: z.string().optional(),
  type: z.nativeEnum(AddressType),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

// Finnish VAT ID (Y-tunnus) validation
const vatIdRegex = /^\d{7}-\d$/;
export const vatIdSchema = z
  .string()
  .regex(vatIdRegex, 'Invalid Finnish VAT ID (Y-tunnus) format. Expected: 1234567-8')
  .optional()
  .nullable();

// Finnish OVT ID validation (OVT/EDI identifier)
const ovtIdRegex = /^0037\d{8}$/;
export const ovtIdSchema = z
  .string()
  .regex(ovtIdRegex, 'Invalid OVT/EDI identifier format. Expected: 0037XXXXXXXX')
  .optional()
  .nullable();

// Schema for customer creation
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  vatId: vatIdSchema,
  ovtId: ovtIdSchema,
  addresses: z.array(addressSchema).min(1, 'At least one address is required'),
});

// Schema for customer update
export const updateCustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  vatId: vatIdSchema,
  ovtId: ovtIdSchema,
  addresses: z.array(addressSchema).min(1, 'At least one address is required'),
});

// Schema for customer list filtering and pagination
export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

// Type inference
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>; 