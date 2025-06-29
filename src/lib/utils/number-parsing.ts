/**
 * Nordic Number Parsing Utilities
 * Handles comma as decimal separator (12,50) and period as thousands separator (1.234,50)
 * Provides safe parsing for Finnish/Swedish/Norwegian number formats
 */

/**
 * Parse a Nordic-formatted number string to a JavaScript number
 * Supports formats like:
 * - "12,50" → 12.50
 * - "1.234,50" → 1234.50
 * - "1234,5" → 1234.5
 * - "12.50" → 12.50 (fallback for period decimal)
 * - "1,234.50" → 1234.50 (fallback for US format)
 */
export function parseNordicNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  if (!value || typeof value !== 'string') {
    return 0;
  }

  // Clean the string - remove whitespace
  const cleaned = value.trim();
  
  if (cleaned === '') {
    return 0;
  }

  // Handle special cases
  if (cleaned === '-' || cleaned === ',' || cleaned === '.') {
    return 0;
  }

  // Count commas and periods to determine format
  const commaCount = (cleaned.match(/,/g) || []).length;
  const periodCount = (cleaned.match(/\./g) || []).length;
  
  let normalizedString: string;

  if (commaCount === 1 && periodCount === 0) {
    // Nordic format with comma decimal: "12,50"
    normalizedString = cleaned.replace(',', '.');
  } else if (commaCount === 0 && periodCount === 1) {
    // US/UK format with period decimal: "12.50"
    normalizedString = cleaned;
  } else if (commaCount === 1 && periodCount >= 1) {
    // Check if comma is decimal (last separator) or thousands
    const commaIndex = cleaned.lastIndexOf(',');
    const periodIndex = cleaned.lastIndexOf('.');
    
    if (commaIndex > periodIndex) {
      // Nordic format: "1.234,50" - comma is decimal
      normalizedString = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: "1,234.50" - period is decimal
      normalizedString = cleaned.replace(/,/g, '');
    }
  } else if (commaCount >= 1 && periodCount === 0) {
    // Multiple commas, assume thousands separators except last: "1,234,567"
    // In Nordic, this would be unusual, but handle gracefully
    normalizedString = cleaned.replace(/,/g, '');
  } else if (periodCount >= 1 && commaCount === 0) {
    // Multiple periods, assume thousands separators except last: "1.234.567"
    // Keep only the last period as decimal
    const lastPeriodIndex = cleaned.lastIndexOf('.');
    normalizedString = cleaned.substring(0, lastPeriodIndex).replace(/\./g, '') + 
                     cleaned.substring(lastPeriodIndex);
  } else {
    // Complex case or no separators - try to parse as-is
    normalizedString = cleaned.replace(/[^\d.-]/g, '');
  }

  const result = parseFloat(normalizedString);
  return isNaN(result) ? 0 : result;
}

/**
 * Parse Nordic number with nullable return (for optional fields)
 */
export function parseNordicNumberNullable(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const result = parseNordicNumber(value);
  return result === 0 && (typeof value === 'string' && value.trim() !== '0') ? null : result;
}

/**
 * Format number for display in Nordic locale (comma as decimal separator)
 */
export function formatNordicNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format currency in Nordic locale (EUR with comma decimal separator)
 */
export function formatNordicCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00 €';
  }

  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/**
 * Create input props for React Hook Form number fields with Nordic parsing
 */
export function createNordicNumberInputProps(field: any) {
  return {
    ...field,
    value: field.value?.toString() || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseNordicNumber(e.target.value);
      field.onChange(parsed);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      // Re-format the display value on blur for better UX
      const parsed = parseNordicNumber(e.target.value);
      e.target.value = parsed.toString();
      field.onBlur?.(e);
    }
  };
}

/**
 * Create input props for nullable number fields
 */
export function createNordicNumberInputPropsNullable(field: any) {
  return {
    ...field,
    value: field.value?.toString() || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();
      if (value === '') {
        field.onChange(null);
      } else {
        const parsed = parseNordicNumber(value);
        field.onChange(parsed);
      }
    },
  };
}

// Test cases for validation (not exported - for development reference)
const testCases = [
  { input: '12,50', expected: 12.50 },
  { input: '1.234,50', expected: 1234.50 },
  { input: '1,234.50', expected: 1234.50 },
  { input: '12.50', expected: 12.50 },
  { input: '1234', expected: 1234 },
  { input: '1234,5', expected: 1234.5 },
  { input: '', expected: 0 },
  { input: '0', expected: 0 },
  { input: '0,00', expected: 0 },
  { input: '-12,50', expected: -12.50 },
]; 