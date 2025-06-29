import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Decimal } from '@prisma/client/runtime/library'; // Import as type

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { parseNordicNumber, formatNordicCurrency } from './utils/number-parsing';

// Basic currency formatter (Nordic-compatible EUR formatting)
export function formatCurrency(amount: number | string | Decimal | null | undefined): string {
  let numericAmount: number;

  if (typeof amount === 'object' && amount !== null && 'toNumber' in amount && typeof amount.toNumber === 'function') {
    // Structurally duck-type for Decimal or similar objects with a toNumber method
    numericAmount = (amount as { toNumber: () => number }).toNumber(); // Use a structural type for the cast
  } else if (typeof amount === 'string') {
    numericAmount = parseNordicNumber(amount); // Use Nordic-compatible parsing
  } else if (typeof amount === 'number') {
    numericAmount = amount;
  } else {
    return "-"; // Handle null, undefined, or other unexpected types
  }

  if (isNaN(numericAmount)) {
    return "-";
  }

  return formatNordicCurrency(numericAmount); // Use Nordic formatting helper
}

// Basic date formatter
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "-";
  }
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Check if dateObj is a valid date
  if (isNaN(dateObj.getTime())) {
      return "-";
  }
  return new Intl.DateTimeFormat('fi-FI', { // Finnish locale
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(dateObj);
}
