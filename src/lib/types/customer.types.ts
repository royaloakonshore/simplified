import { UUID, Email, VatId, OvtId } from './branded';

export enum AddressType {
  Billing = 'billing',
  Shipping = 'shipping',
}

export interface Address {
  id?: string;
  type: AddressType;
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  vatId?: string | null; // Y-tunnus in Finland
  ovtId?: string | null; // OVT/EDI identifier
  addresses?: Address[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Domain model with branded types for enhanced type safety
export interface CustomerDomain {
  id: UUID;
  name: string;
  email: Email | null;
  phone: string | null;
  vatId: VatId | null;
  ovtId: OvtId | null;
  addresses: AddressDomain[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressDomain {
  id: UUID;
  type: AddressType;
  street: string;
  city: string;
  postalCode: string;
  country: string;
} 