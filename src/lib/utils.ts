import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Decimal } from '@prisma/client/runtime/library';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Basic currency formatter (assumes EUR for now)
export function formatCurrency(amount: number | string | Decimal): string {
  const numericAmount = typeof amount === 'object' && amount !== null && typeof (amount as any).toString === 'function'
    ? parseFloat((amount as any).toString())
    : typeof amount === 'string' ? parseFloat(amount) : amount;

  if (typeof numericAmount !== 'number' || isNaN(numericAmount)) {
    return "-";
  }

  return new Intl.NumberFormat('fi-FI', { // Finnish locale for formatting
    style: 'currency',
    currency: 'EUR',
  }).format(numericAmount);
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
