/**
 * Finnish Reference Number (Viitenumero) Generator
 * 
 * Implements the Finnish banking standard for reference numbers using modulus 10 algorithm.
 * Based on: https://johannwalder.com/blog/2014/04/25/how-to-generate-a-reference-number-for-the-finnish-banking-system/
 */

/**
 * Calculate check digit for Finnish reference number
 * @param baseNumber - Base number string (3-19 digits)
 * @returns Check digit (0-9)
 */
function calculateCheckDigit(baseNumber: string): number {
  const multipliers = [7, 3, 1];
  let multiplierIndex = 0;
  let sum = 0;

  // Process digits from right to left
  for (let i = baseNumber.length - 1; i >= 0; i--) {
    if (multiplierIndex === 3) {
      multiplierIndex = 0;
    }
    
    sum += parseInt(baseNumber[i]!) * multipliers[multiplierIndex]!;
    multiplierIndex++;
  }

  let checkDigit = 10 - (sum % 10);
  
  // If check digit is 10, set it to 0
  if (checkDigit === 10) {
    checkDigit = 0;
  }

  return checkDigit;
}

/**
 * Generate Finnish reference number from base number
 * @param baseNumber - Base number (3-19 digits)
 * @returns Complete reference number with check digit
 */
export function generateFinnishReferenceNumber(baseNumber: string): string {
  // Validate input
  if (!baseNumber || !/^\d{3,19}$/.test(baseNumber)) {
    throw new Error('Base number must be 3-19 digits');
  }

  const checkDigit = calculateCheckDigit(baseNumber);
  return baseNumber + checkDigit.toString();
}

/**
 * Format reference number for better readability (5-digit blocks from right)
 * @param referenceNumber - Complete reference number
 * @returns Formatted reference number with spaces
 */
export function formatReferenceNumber(referenceNumber: string): string {
  // Add spaces every 5 digits from the right
  return referenceNumber.replace(/(.{5})(?=.)/g, '$1 ').trim();
}

/**
 * Generate reference number from invoice number
 * @param invoiceNumber - Invoice number (e.g., "INV-00001")
 * @returns Complete reference number
 */
export function generateInvoiceReferenceNumber(invoiceNumber: string): string {
  // Extract numeric part from invoice number
  const numericPart = invoiceNumber.replace(/\D/g, '');
  
  if (!numericPart) {
    throw new Error('Invoice number must contain numeric digits');
  }

  // Ensure minimum 3 digits by padding with zeros
  const baseNumber = numericPart.padStart(3, '0');
  
  return generateFinnishReferenceNumber(baseNumber);
}

/**
 * Validate Finnish reference number
 * @param referenceNumber - Reference number to validate
 * @returns True if valid
 */
export function validateFinnishReferenceNumber(referenceNumber: string): boolean {
  try {
    // Remove spaces and validate format
    const cleanNumber = referenceNumber.replace(/\s/g, '');
    
    if (!/^\d{4,20}$/.test(cleanNumber)) {
      return false;
    }

    // Extract base number and check digit
    const baseNumber = cleanNumber.slice(0, -1);
    const providedCheckDigit = parseInt(cleanNumber.slice(-1)!);
    
    // Calculate expected check digit
    const expectedCheckDigit = calculateCheckDigit(baseNumber);
    
    return providedCheckDigit === expectedCheckDigit;
  } catch {
    return false;
  }
} 