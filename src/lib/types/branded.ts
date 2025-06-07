import { Decimal as PrismaRuntimeDecimal } from '@prisma/client/runtime/library';

/**
 * Branded types for enhanced type safety
 * These types allow us to differentiate between primitive types 
 * with different semantic meanings, even though they have the same underlying structure.
 */

// UUID branded type
export type UUID = string & { readonly __brand: unique symbol };

// Create UUID from string
export function createUUID(id: string): UUID {
  return id as UUID;
}

// Decimal branded type for monetary values and quantities
export type Decimal = number & { readonly __brand: unique symbol };

// Create Decimal from PrismaRuntimeDecimal, string, or number
export function createDecimal(value: PrismaRuntimeDecimal | string | number | null | undefined): Decimal {
  if (value === null || value === undefined) {
    // Or throw error, or return a default branded 0, depending on desired handling for null/undefined
    // For now, let's assume it should not be null/undefined if a Decimal is expected.
    // Or, if your local Decimal type can be null/undefined, the return type here should be Decimal | null or Decimal | undefined
    throw new Error('Cannot create Decimal from null or undefined');
  }
  if (value instanceof PrismaRuntimeDecimal) {
    return value.toNumber() as Decimal;
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      // Consider how to handle invalid string-to-number conversions
      // Throwing an error might be appropriate, or returning a specific branded error value
      throw new Error(`Invalid string value for Decimal: "${value}"`);
    }
    return num as Decimal;
  }
  // value is already a number
  return value as Decimal;
}

// ISO Date string branded type
export type DateString = string & { readonly __brand: unique symbol };

// Create DateString from string
export function createDateString(date: string): DateString {
  return date as DateString;
}

// Currency code branded type
export type CurrencyCode = string & { readonly __brand: unique symbol };

// Create CurrencyCode from string
export function createCurrencyCode(code: string): CurrencyCode {
  return code as CurrencyCode;
}

// Email branded type
export type Email = string & { readonly __brand: unique symbol };

// Create Email from string
export function createEmail(email: string): Email {
  return email as Email;
}

// VAT ID (Y-tunnus in Finland) branded type
export type VatId = string & { readonly __brand: unique symbol };

// Create VatId from string
export function createVatId(id: string): VatId {
  return id as VatId;
}

// OVT/EDI Identifier branded type 
export type OvtId = string & { readonly __brand: unique symbol };

// Create OvtId from string
export function createOvtId(id: string): OvtId {
  return id as OvtId;
} 