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

// Create Decimal from number
export function createDecimal(value: number): Decimal {
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