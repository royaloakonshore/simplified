import { UUID, Decimal } from './branded';

export enum MaterialType {
  RawMaterial = 'raw_material',
  Manufactured = 'manufactured',
}

export enum TransactionType {
  Purchase = 'purchase',
  Sale = 'sale',
  Adjustment = 'adjustment',
}

export interface InventoryItem {
  id?: string;
  sku: string;
  name: string;
  description?: string | null;
  unitOfMeasure: string; // Free text field (e.g., 'kpl', 'ltr')
  costPrice: number;
  salesPrice: number;
  materialType: MaterialType;
  minimumStockLevel: number; // To determine criticality
  reorderLevel: number; // When purchases are needed
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InventoryTransaction {
  id?: string;
  itemId: string;
  quantity: number;
  type: TransactionType;
  reference?: string | null;
  note?: string | null;
  createdAt?: Date;
}

// Domain model with branded types for enhanced type safety
export interface InventoryItemDomain {
  id: UUID;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  costPrice: Decimal;
  salesPrice: Decimal;
  materialType: MaterialType;
  minimumStockLevel: Decimal;
  reorderLevel: Decimal;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryTransactionDomain {
  id: UUID;
  itemId: UUID;
  quantity: Decimal;
  type: TransactionType;
  reference: string | null;
  note: string | null;
  createdAt: Date;
}

// Quantity status based on stock level
export enum QuantityStatus {
  Critical = 'critical', // Below minimumStockLevel
  Low = 'low', // Below reorderLevel but above minimumStockLevel
  Normal = 'normal', // Above reorderLevel
}

// Extended inventory item with calculated fields
export interface InventoryItemWithStock extends InventoryItem {
  quantityOnHand: number;
  quantityStatus: QuantityStatus;
} 