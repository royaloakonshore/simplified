/**
 * Nordic number formatting utilities
 * Handles decimal comma (,) as used in Nordic countries instead of decimal point (.)
 */

/**
 * Parse a Nordic number string (with comma as decimal separator) to a JavaScript number
 * @param value - String value that may contain comma as decimal separator
 * @returns Parsed number or NaN if invalid
 */
export function parseNordicNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  // Replace comma with dot for JavaScript parsing
  const normalizedValue = value.toString().replace(',', '.');
  return parseFloat(normalizedValue);
}

/**
 * Format a number for Nordic display (with comma as decimal separator)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with comma as decimal separator
 */
export function formatNordicNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  
  return value.toFixed(decimals).replace('.', ',');
}

/**
 * Validate if a string represents a valid Nordic number
 * @param value - String to validate
 * @returns true if valid Nordic number format
 */
export function isValidNordicNumber(value: string): boolean {
  if (!value || value.trim() === '') {
    return true; // Empty is valid (optional field)
  }
  
  // Allow numbers with comma as decimal separator
  const nordicNumberRegex = /^-?\d+([,]\d+)?$/;
  return nordicNumberRegex.test(value.trim());
}

/**
 * Convert a Nordic number string to a value suitable for HTML input[type="number"]
 * HTML number inputs expect dot as decimal separator
 * @param value - Nordic number string
 * @returns String with dot as decimal separator for HTML input
 */
export function nordicToHtmlNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  return value.toString().replace(',', '.');
}

/**
 * Convert HTML input value back to Nordic format
 * @param value - HTML input value (with dot as decimal separator)
 * @returns Nordic formatted string (with comma as decimal separator)
 */
export function htmlToNordicNumber(value: string): string {
  if (!value) {
    return '';
  }
  
  return value.replace('.', ',');
}
