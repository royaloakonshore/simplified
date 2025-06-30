/**
 * Margin Calculation Utilities
 * Provides consistent margin calculations across the application
 * Formula: (invoiced sales price - manufactured item labor cost - purchase price)
 */

import { Decimal } from "@prisma/client/runtime/library";
import { parseNordicNumber } from "./number-parsing";

// Types for margin calculations
export interface MarginCalculationItem {
  quantity: number | Decimal;
  unitPrice: number | Decimal;
  discountAmount?: number | Decimal | null;
  discountPercentage?: number | Decimal | null;
  inventoryItem: {
    itemType: string;
    costPrice: number | Decimal;
  };
  billOfMaterial?: {
    manualLaborCost?: number | Decimal | null;
    items?: Array<{
      quantity: number | Decimal;
      inventoryItem: {
        costPrice: number | Decimal;
      };
    }>;
  } | null;
}

export interface MarginCalculationResult {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  itemCount: number;
}

export interface CustomerMarginData {
  customerId: string;
  totalRevenue: number;
  totalMargin: number;
  marginPercentage: number;
  invoiceCount: number;
  period: string; // e.g., "Last 12 months"
}

/**
 * Convert various number types to a safe number for calculations
 */
function toSafeNumber(value: number | Decimal | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  if (typeof value === 'string') return parseNordicNumber(value);
  
  // Handle Decimal objects
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      return (value as any).toNumber();
    } catch {
      return 0;
    }
  }
  
  return 0;
}

/**
 * Calculate the cost of a single item based on its type and BOM
 */
export function calculateItemCost(item: MarginCalculationItem): number {
  const itemType = item.inventoryItem.itemType;
  
  if (itemType === 'RAW_MATERIAL') {
    // For raw materials, use the direct cost price
    return toSafeNumber(item.inventoryItem.costPrice);
  }
  
  if (itemType === 'MANUFACTURED_GOOD' && item.billOfMaterial) {
    let totalCost = 0;
    
    // Add manual labor cost
    if (item.billOfMaterial.manualLaborCost) {
      totalCost += toSafeNumber(item.billOfMaterial.manualLaborCost);
    }
    
    // Add BOM component costs
    if (item.billOfMaterial.items) {
      for (const bomItem of item.billOfMaterial.items) {
        const componentCost = toSafeNumber(bomItem.inventoryItem.costPrice);
        const componentQuantity = toSafeNumber(bomItem.quantity);
        totalCost += componentCost * componentQuantity;
      }
    }
    
    return totalCost;
  }
  
  // Fallback to cost price for unknown types
  return toSafeNumber(item.inventoryItem.costPrice);
}

/**
 * Calculate line item revenue after discounts
 */
export function calculateLineRevenue(item: MarginCalculationItem): number {
  const quantity = toSafeNumber(item.quantity);
  const unitPrice = toSafeNumber(item.unitPrice);
  let lineTotal = quantity * unitPrice;
  
  // Apply line-level discounts
  if (item.discountAmount) {
    lineTotal -= toSafeNumber(item.discountAmount);
  } else if (item.discountPercentage) {
    const discountPercent = toSafeNumber(item.discountPercentage);
    lineTotal -= lineTotal * (discountPercent / 100);
  }
  
  return Math.max(0, lineTotal); // Ensure non-negative
}

/**
 * Calculate margin for a collection of items (invoice, order, etc.)
 */
export function calculateMargin(items: MarginCalculationItem[]): MarginCalculationResult {
  let totalRevenue = 0;
  let totalCost = 0;
  
  for (const item of items) {
    const lineRevenue = calculateLineRevenue(item);
    const unitCost = calculateItemCost(item);
    const quantity = toSafeNumber(item.quantity);
    const lineCost = unitCost * quantity;
    
    totalRevenue += lineRevenue;
    totalCost += lineCost;
  }
  
  const totalMargin = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  
  return {
    totalRevenue,
    totalCost,
    totalMargin,
    marginPercentage,
    itemCount: items.length,
  };
}

/**
 * Format margin percentage for display
 */
export function formatMarginPercentage(percentage: number): string {
  if (isNaN(percentage) || !isFinite(percentage)) return "0.0%";
  return `${percentage.toFixed(1)}%`;
}

/**
 * Format currency for margin display (using Nordic formatting)
 */
export function formatMarginCurrency(amount: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Get margin status color based on percentage
 */
export function getMarginStatusColor(percentage: number): "default" | "secondary" | "destructive" | "outline" {
  if (percentage >= 30) return "default";      // Good margin (green)
  if (percentage >= 15) return "outline";     // Acceptable margin (blue)
  if (percentage >= 0) return "secondary";    // Low margin (gray)
  return "destructive";                       // Negative margin (red)
}

/**
 * Compare current margin to customer average
 */
export function compareToCustomerAverage(
  currentMarginPercentage: number,
  customerAveragePercentage: number
): {
  difference: number;
  isAboveAverage: boolean;
  description: string;
} {
  const difference = currentMarginPercentage - customerAveragePercentage;
  const isAboveAverage = difference > 0;
  
  let description = "";
  if (Math.abs(difference) < 1) {
    description = "Similar to customer average";
  } else if (isAboveAverage) {
    description = `${Math.abs(difference).toFixed(1)}% above customer average`;
  } else {
    description = `${Math.abs(difference).toFixed(1)}% below customer average`;
  }
  
  return {
    difference,
    isAboveAverage,
    description,
  };
} 