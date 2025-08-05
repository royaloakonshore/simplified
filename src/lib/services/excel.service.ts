import * as XLSX from 'xlsx';
import type { 
  Customer, 
  Invoice, 
  InvoiceItem, 
  Order, 
  OrderItem, 
  InventoryItem,
  InventoryCategory,
  ItemType,
  Prisma
} from '@prisma/client';

// Types for Excel data
export type ExcelCustomerData = {
  name: string;
  email?: string;
  phone?: string;
  vatId?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  language?: 'FI' | 'SE' | 'EN';
  defaultPaymentTermsDays?: number;
};

// Enhanced inventory data type with all fields
export type ExcelInventoryData = {
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  costPrice?: number;
  salesPrice: number;
  quantityOnHand?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  vendorSku?: string;
  vendorItemName?: string;
  itemType?: 'RAW_MATERIAL' | 'MANUFACTURED_GOOD';
  showInPricelist?: boolean;
  minimumStockLevel?: number;
  // Legacy fields for backward compatibility
  unitPrice?: number; // alias for salesPrice
  currentQuantity?: number; // alias for quantityOnHand
  reorderPoint?: number; // alias for reorderLevel
};

export type ExcelInvoiceData = {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'credited';
  totalAmount: number;
  totalVatAmount: number;
  notes?: string;
  items: {
    itemName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    vatRatePercent: number;
  }[];
};

// Enhanced validation functions inspired by XToolset mappers
class InventoryImportValidator {
  static validateString(value: any, fieldName: string, required: boolean = true): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      if (required) {
        errors.push(`${fieldName} is required`);
        return { isValid: false, value: null, errors, warnings };
      }
      return { isValid: true, value: undefined, errors, warnings };
    }
    
    if (typeof value !== 'string') {
      warnings.push(`${fieldName} was converted from ${typeof value} to string`);
    }
    
    const cleanValue = String(value).trim();
    if (cleanValue.length > 255) {
      errors.push(`${fieldName} is too long (max 255 characters)`);
      return { isValid: false, value: null, errors, warnings };
    }
    
    return { isValid: true, value: cleanValue, errors, warnings };
  }

  static validateNumber(value: any, fieldName: string, required: boolean = false, min?: number, max?: number): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (value === null || value === undefined || value === '') {
      if (required) {
        errors.push(`${fieldName} is required`);
        return { isValid: false, value: null, errors, warnings };
      }
      return { isValid: true, value: undefined, errors, warnings };
    }
    
    // Handle Finnish decimal separator
    let numericValue: number;
    if (typeof value === 'string') {
      const normalizedValue = value.replace(',', '.');
      numericValue = parseFloat(normalizedValue);
    } else {
      numericValue = Number(value);
    }
    
    if (isNaN(numericValue)) {
      errors.push(`${fieldName} must be a valid number`);
      return { isValid: false, value: null, errors, warnings };
    }
    
    if (min !== undefined && numericValue < min) {
      errors.push(`${fieldName} cannot be less than ${min}`);
      return { isValid: false, value: null, errors, warnings };
    }
    
    if (max !== undefined && numericValue > max) {
      errors.push(`${fieldName} cannot be greater than ${max}`);
      return { isValid: false, value: null, errors, warnings };
    }
    
    return { isValid: true, value: numericValue, errors, warnings };
  }

  static validateItemType(value: any): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!value) {
      return { isValid: true, value: 'MANUFACTURED_GOOD', errors, warnings };
    }
    
    const normalized = String(value).toLowerCase();
    if (normalized.includes('raaka') || normalized.includes('raw')) {
      return { isValid: true, value: 'RAW_MATERIAL', errors, warnings };
    }
    if (normalized.includes('valmiste') || normalized.includes('manufactured')) {
      return { isValid: true, value: 'MANUFACTURED_GOOD', errors, warnings };
    }
    
    warnings.push(`Unknown item type "${value}", defaulting to MANUFACTURED_GOOD`);
    return { isValid: true, value: 'MANUFACTURED_GOOD', errors, warnings };
  }

  static validateBoolean(value: any): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (value === null || value === undefined || value === '') {
      return { isValid: true, value: true, errors, warnings }; // Default to true for showInPricelist
    }
    
    const normalized = String(value).toLowerCase();
    if (['true', '1', 'yes', 'kyllä', 'on'].includes(normalized)) {
      return { isValid: true, value: true, errors, warnings };
    }
    if (['false', '0', 'no', 'ei', 'off'].includes(normalized)) {
      return { isValid: true, value: false, errors, warnings };
    }
    
    warnings.push(`Unknown boolean value "${value}", defaulting to true`);
    return { isValid: true, value: true, errors, warnings };
  }

  static validateSKU(value: any, required: boolean = false): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      if (required) {
        errors.push('SKU is required for identifying existing items');
        return { isValid: false, value: null, errors, warnings };
      }
      warnings.push('No SKU provided - item will be created as new');
      return { isValid: true, value: undefined, errors, warnings };
    }
    
    const cleanValue = String(value).trim().toUpperCase();
    
    // Basic SKU format validation
    if (cleanValue.length > 50) {
      errors.push('SKU is too long (max 50 characters)');
      return { isValid: false, value: null, errors, warnings };
    }
    
    // Check for invalid characters
    if (!/^[A-Z0-9\-_]+$/.test(cleanValue)) {
      warnings.push('SKU contains unusual characters - consider using only letters, numbers, hyphens, and underscores');
    }
    
    return { isValid: true, value: cleanValue, errors, warnings };
  }
}

// Validation result types inspired by XToolset
export interface ImportValidationResult {
  isValid: boolean;
  value: any;
  errors: string[];
  warnings: string[];
}

export interface ImportRowResult {
  rowIndex: number;
  data: ExcelInventoryData | null;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface ImportPreview {
  newItems: ExcelInventoryData[];
  updateItems: Array<{
    sku: string;
    existingData: Partial<InventoryItem>;
    newData: ExcelInventoryData;
    changes: Record<string, { old: any; new: any }>;
  }>;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  summary: {
    totalRows: number;
    newItemCount: number;
    updateItemCount: number;
    errorCount: number;
    warningCount: number;
  };
}

/**
 * Export customers to Excel
 */
export function exportCustomersToExcel(customers: Customer[]): Buffer {
  const worksheetData = customers.map(customer => ({
    'Nimi / Name': customer.name,
    'Sähköposti / Email': customer.email || '',
    'Puhelin / Phone': customer.phone || '',
    'Y-tunnus / VAT ID': customer.vatId || '',
    'Osoite / Address': (customer as any).address || '',
    'Postinumero / Postal Code': (customer as any).postalCode || '',
    'Kaupunki / City': (customer as any).city || '',
    'Maa / Country': (customer as any).country || 'Finland',
    'Kieli / Language': customer.language || 'FI',
    'Maksuehto (pv) / Payment Terms (days)': (customer as any).defaultPaymentTermsDays || '',
    'Luotu / Created': new Date(customer.createdAt).toLocaleDateString('fi-FI'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asiakkaat');

  // Auto-width columns
  const colWidths = [
    { wch: 25 }, // Name
    { wch: 25 }, // Email
    { wch: 15 }, // Phone
    { wch: 15 }, // VAT ID
    { wch: 30 }, // Address
    { wch: 12 }, // Postal Code
    { wch: 20 }, // City
    { wch: 15 }, // Country
    { wch: 8 },  // Language
    { wch: 15 }, // Payment Terms
    { wch: 12 }, // Created
  ];
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Export inventory items to Excel with enhanced fields
 */
export function exportInventoryToExcel(items: (InventoryItem & { inventoryCategory?: InventoryCategory | null })[]): Buffer {
  const worksheetData = items.map(item => ({
    'Nimi / Name': item.name,
    'Kuvaus / Description': item.description || '',
    'Kategoria / Category': item.inventoryCategory?.name || '',
    'SKU': item.sku || '',
    'Ostohinta / Cost Price': item.costPrice?.toString().replace('.', ',') || '',
    'Yksikköhinta / Unit Price': item.salesPrice.toString().replace('.', ','),
    'Määrä / Quantity': item.quantityOnHand?.toString() || '0',
    'Hälytysraja / Reorder Point': item.reorderLevel?.toString() || '',
    'Toimitusaika / Lead Time (Days)': item.leadTimeDays?.toString() || '',
    'Toimittajan SKU / Vendor SKU': item.vendorSku || '',
    'Toimittajan nimi / Vendor Item Name': item.vendorItemName || '',
    'Minimisaldo / Minimum Stock': item.minimumStockLevel?.toString() || '',
    'Hinnastossa / Show in Pricelist': item.showInPricelist ? 'Kyllä' : 'Ei',
    'Tyyppi / Type': item.itemType === 'RAW_MATERIAL' ? 'Raaka-aine' : 'Valmiste',
    'Luotu / Created': new Date(item.createdAt).toLocaleDateString('fi-FI'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tuotteet');

  const colWidths = [
    { wch: 25 }, // Name
    { wch: 40 }, // Description
    { wch: 15 }, // Category
    { wch: 15 }, // SKU
    { wch: 12 }, // Cost Price
    { wch: 12 }, // Sales Price
    { wch: 10 }, // Quantity
    { wch: 12 }, // Reorder Point
    { wch: 10 }, // Lead Time
    { wch: 15 }, // Vendor SKU
    { wch: 20 }, // Vendor Item Name
    { wch: 12 }, // Minimum Stock
    { wch: 12 }, // Show in Pricelist
    { wch: 12 }, // Type
    { wch: 12 }, // Created
  ];
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Export invoices to Excel
 */
export function exportInvoicesToExcel(
  invoices: (Invoice & { 
    customer: Customer; 
    items: (InvoiceItem & { inventoryItem: InventoryItem })[] 
  })[]
): Buffer {
  const worksheetData = invoices.map(invoice => ({
    'Laskunumero / Invoice Number': invoice.invoiceNumber,
    'Asiakas / Customer': invoice.customer.name,
    'Laskupäivä / Invoice Date': new Date(invoice.invoiceDate).toLocaleDateString('fi-FI'),
    'Eräpäivä / Due Date': new Date(invoice.dueDate).toLocaleDateString('fi-FI'),
    'Tila / Status': getInvoiceStatusFinnish(invoice.status),
    'Summa (veroton) / Amount (ex. VAT)': (invoice.totalAmount.toNumber() - invoice.totalVatAmount.toNumber()).toFixed(2).replace('.', ','),
    'ALV / VAT': invoice.totalVatAmount.toString().replace('.', ','),
    'Loppusumma / Total': invoice.totalAmount.toString().replace('.', ','),
    'Rivejä / Items': invoice.items.length,
    'Huomiot / Notes': invoice.notes || '',
    'Luotu / Created': new Date(invoice.createdAt).toLocaleDateString('fi-FI'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laskut');

  const colWidths = [
    { wch: 15 }, // Invoice Number
    { wch: 25 }, // Customer
    { wch: 12 }, // Invoice Date
    { wch: 12 }, // Due Date
    { wch: 12 }, // Status
    { wch: 15 }, // Amount
    { wch: 10 }, // VAT
    { wch: 15 }, // Total
    { wch: 8 },  // Items
    { wch: 30 }, // Notes
    { wch: 12 }, // Created
  ];
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Export orders to Excel
 */
export function exportOrdersToExcel(
  orders: (Order & { 
    customer: Customer; 
    items: (OrderItem & { inventoryItem: InventoryItem })[] 
  })[]
): Buffer {
  const worksheetData = orders.map(order => ({
    'Tilausnumero / Order Number': order.orderNumber,
    'Asiakas / Customer': order.customer.name,
    'Tyyppi / Type': order.orderType === 'quotation' ? 'Tarjous' : 'Työtilaus',
    'Tilauspäivä / Order Date': new Date(order.createdAt).toLocaleDateString('fi-FI'),
    'Toimituspäivä / Delivery Date': order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('fi-FI') : '',
    'Tila / Status': getOrderStatusFinnish(order.status),
    'Summa / Total': order.totalAmount?.toString().replace('.', ',') || '0,00',
    'Rivejä / Items': order.items.length,
    'Huomiot / Notes': order.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tilaukset');

  const colWidths = [
    { wch: 15 }, // Order Number
    { wch: 25 }, // Customer
    { wch: 12 }, // Type
    { wch: 12 }, // Order Date
    { wch: 12 }, // Delivery Date
    { wch: 12 }, // Status
    { wch: 15 }, // Amount
    { wch: 10 }, // VAT
    { wch: 15 }, // Total
    { wch: 8 },  // Items
    { wch: 30 }, // Notes
  ];
  worksheet['!cols'] = colWidths;

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Import customers from Excel file
 */
export function importCustomersFromExcel(fileBuffer: Buffer): ExcelCustomerData[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
  
  return jsonData.map((row, index) => {
    try {
      return {
        name: validateString(row['Nimi / Name'] || row['Name'] || row['Nimi'], `Row ${index + 1}: Name is required`),
        email: row['Sähköposti / Email'] || row['Email'] || row['Sähköposti'] || undefined,
        phone: row['Puhelin / Phone'] || row['Phone'] || row['Puhelin'] || undefined,
        vatId: row['Y-tunnus / VAT ID'] || row['VAT ID'] || row['Y-tunnus'] || undefined,
        address: row['Osoite / Address'] || row['Address'] || row['Osoite'] || undefined,
        postalCode: row['Postinumero / Postal Code'] || row['Postal Code'] || row['Postinumero'] || undefined,
        city: row['Kaupunki / City'] || row['City'] || row['Kaupunki'] || undefined,
        country: row['Maa / Country'] || row['Country'] || row['Maa'] || 'Finland',
        language: validateLanguage(row['Kieli / Language'] || row['Language'] || row['Kieli'] || 'FI'),
        defaultPaymentTermsDays: parseNumber(row['Maksuehto (pv) / Payment Terms (days)'] || row['Payment Terms'] || row['Maksuehto']) || undefined,
      };
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
    }
  });
}

/**
 * Enhanced inventory import with comprehensive validation and preview
 */
export function importInventoryFromExcelWithValidation(
  fileBuffer: Buffer,
  existingItems: InventoryItem[] = []
): ImportPreview {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
  
  const newItems: ExcelInventoryData[] = [];
  const updateItems: ImportPreview['updateItems'] = [];
  const errors: ImportPreview['errors'] = [];
  let errorCount = 0;
  let warningCount = 0;

  // Create SKU lookup map for existing items
  const existingItemsBySku = new Map<string, InventoryItem>();
  existingItems.forEach(item => {
    if (item.sku) {
      existingItemsBySku.set(item.sku.toUpperCase(), item);
    }
  });

  jsonData.forEach((row, index) => {
    const rowNumber = index + 2; // Account for header row and 0-based index
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    try {
      // Validate all fields
      const nameResult = InventoryImportValidator.validateString(
        row['Nimi / Name'] || row['Name'] || row['Nimi'], 
        'Name', 
        true
      );
      
      const descriptionResult = InventoryImportValidator.validateString(
        row['Kuvaus / Description'] || row['Description'] || row['Kuvaus'], 
        'Description', 
        false
      );
      
      const skuResult = InventoryImportValidator.validateSKU(
        row['SKU'], 
        false
      );
      
      const costPriceResult = InventoryImportValidator.validateNumber(
        row['Ostohinta / Cost Price'] || row['Cost Price'] || row['Ostohinta'], 
        'Cost Price', 
        false, 
        0
      );
      
      const salesPriceResult = InventoryImportValidator.validateNumber(
        row['Yksikköhinta / Unit Price'] || row['Sales Price'] || row['Unit Price'] || row['Yksikköhinta'], 
        'Sales Price', 
        true, 
        0
      );
      
      const quantityResult = InventoryImportValidator.validateNumber(
        row['Määrä / Quantity'] || row['Quantity'] || row['Määrä'], 
        'Quantity', 
        false, 
        0
      );
      
      const reorderLevelResult = InventoryImportValidator.validateNumber(
        row['Hälytysraja / Reorder Point'] || row['Reorder Point'] || row['Hälytysraja'], 
        'Reorder Level', 
        false, 
        0
      );
      
      const leadTimeResult = InventoryImportValidator.validateNumber(
        row['Toimitusaika / Lead Time (Days)'] || row['Lead Time (Days)'] || row['Toimitusaika'], 
        'Lead Time', 
        false, 
        0, 
        365
      );
      
      const minimumStockResult = InventoryImportValidator.validateNumber(
        row['Minimisaldo / Minimum Stock'] || row['Minimum Stock'] || row['Minimisaldo'], 
        'Minimum Stock Level', 
        false, 
        0
      );
      
      const itemTypeResult = InventoryImportValidator.validateItemType(
        row['Tyyppi / Type'] || row['Type'] || row['Tyyppi']
      );
      
      const showInPricelistResult = InventoryImportValidator.validateBoolean(
        row['Hinnastossa / Show in Pricelist'] || row['Show in Pricelist'] || row['Hinnastossa']
      );
      
      const vendorSkuResult = InventoryImportValidator.validateString(
        row['Toimittajan SKU / Vendor SKU'] || row['Vendor SKU'] || row['Toimittajan SKU'], 
        'Vendor SKU', 
        false
      );
      
      const vendorItemNameResult = InventoryImportValidator.validateString(
        row['Toimittajan nimi / Vendor Item Name'] || row['Vendor Item Name'] || row['Toimittajan nimi'], 
        'Vendor Item Name', 
        false
      );

      // Collect all errors and warnings
      const allResults = [
        nameResult, descriptionResult, skuResult, costPriceResult, salesPriceResult,
        quantityResult, reorderLevelResult, leadTimeResult, minimumStockResult,
        itemTypeResult, showInPricelistResult, vendorSkuResult, vendorItemNameResult
      ];

      allResults.forEach(result => {
        rowErrors.push(...result.errors);
        rowWarnings.push(...result.warnings);
      });

      // If there are validation errors, skip this row
      if (rowErrors.length > 0) {
        rowErrors.forEach(error => {
          errors.push({
            row: rowNumber,
            field: 'validation',
            message: error,
            severity: 'error'
          });
        });
        errorCount += rowErrors.length;
        return;
      }

      // Add warnings
      rowWarnings.forEach(warning => {
        errors.push({
          row: rowNumber,
          field: 'validation',
          message: warning,
          severity: 'warning'
        });
      });
      warningCount += rowWarnings.length;

      // Build the validated item data
      const itemData: ExcelInventoryData = {
        name: nameResult.value,
        description: descriptionResult.value,
        sku: skuResult.value,
        costPrice: costPriceResult.value,
        salesPrice: salesPriceResult.value,
        quantityOnHand: quantityResult.value || 0,
        reorderLevel: reorderLevelResult.value,
        leadTimeDays: leadTimeResult.value,
        minimumStockLevel: minimumStockResult.value || 0,
        itemType: itemTypeResult.value as 'RAW_MATERIAL' | 'MANUFACTURED_GOOD',
        showInPricelist: showInPricelistResult.value,
        vendorSku: vendorSkuResult.value,
        vendorItemName: vendorItemNameResult.value,
        category: row['Kategoria / Category'] || row['Category'] || row['Kategoria'] || undefined,
      };

      // Determine if this is a new item or update
      if (itemData.sku && existingItemsBySku.has(itemData.sku.toUpperCase())) {
        const existingItem = existingItemsBySku.get(itemData.sku.toUpperCase())!;
        const changes: Record<string, { old: any; new: any }> = {};

        // Compare fields and track changes
        if (itemData.name !== existingItem.name) {
          changes.name = { old: existingItem.name, new: itemData.name };
        }
        if (itemData.description !== existingItem.description) {
          changes.description = { old: existingItem.description, new: itemData.description };
        }
        if (itemData.costPrice !== undefined && itemData.costPrice !== existingItem.costPrice?.toNumber()) {
          changes.costPrice = { old: existingItem.costPrice?.toNumber(), new: itemData.costPrice };
        }
        if (itemData.salesPrice !== existingItem.salesPrice?.toNumber()) {
          changes.salesPrice = { old: existingItem.salesPrice?.toNumber(), new: itemData.salesPrice };
        }
        if (itemData.quantityOnHand !== undefined && itemData.quantityOnHand !== existingItem.quantityOnHand?.toNumber()) {
          changes.quantityOnHand = { old: existingItem.quantityOnHand?.toNumber(), new: itemData.quantityOnHand };
        }
        if (itemData.reorderLevel !== undefined && itemData.reorderLevel !== existingItem.reorderLevel?.toNumber()) {
          changes.reorderLevel = { old: existingItem.reorderLevel?.toNumber(), new: itemData.reorderLevel };
        }
        if (itemData.leadTimeDays !== undefined && itemData.leadTimeDays !== existingItem.leadTimeDays) {
          changes.leadTimeDays = { old: existingItem.leadTimeDays, new: itemData.leadTimeDays };
        }
        if (itemData.minimumStockLevel !== undefined && itemData.minimumStockLevel !== existingItem.minimumStockLevel?.toNumber()) {
          changes.minimumStockLevel = { old: existingItem.minimumStockLevel?.toNumber(), new: itemData.minimumStockLevel };
        }
        if (itemData.itemType !== existingItem.itemType) {
          changes.itemType = { old: existingItem.itemType, new: itemData.itemType };
        }
        if (itemData.showInPricelist !== undefined && itemData.showInPricelist !== existingItem.showInPricelist) {
          changes.showInPricelist = { old: existingItem.showInPricelist, new: itemData.showInPricelist };
        }
        if (itemData.vendorSku !== existingItem.vendorSku) {
          changes.vendorSku = { old: existingItem.vendorSku, new: itemData.vendorSku };
        }
        if (itemData.vendorItemName !== existingItem.vendorItemName) {
          changes.vendorItemName = { old: existingItem.vendorItemName, new: itemData.vendorItemName };
        }

        // Only add to update list if there are actual changes
        if (Object.keys(changes).length > 0) {
          updateItems.push({
            sku: existingItem.sku || itemData.sku!, // Use existing SKU or fallback to itemData SKU
            existingData: existingItem,
            newData: itemData,
            changes
          });
        }
      } else {
        newItems.push(itemData);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      errors.push({
        row: rowNumber,
        field: 'general',
        message: errorMessage,
        severity: 'error'
      });
      errorCount++;
    }
  });

  return {
    newItems,
    updateItems,
    errors,
    summary: {
      totalRows: jsonData.length,
      newItemCount: newItems.length,
      updateItemCount: updateItems.length,
      errorCount,
      warningCount
    }
  };
}

/**
 * Legacy import function for backward compatibility
 */
export function importInventoryFromExcel(fileBuffer: Buffer): ExcelInventoryData[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
  
  return jsonData.map((row, index) => {
    try {
      const data: ExcelInventoryData = {
        name: validateString(row['Nimi / Name'] || row['Name'] || row['Nimi'], `Row ${index + 1}: Name is required`),
        description: row['Kuvaus / Description'] || row['Description'] || row['Kuvaus'] || undefined,
        category: row['Kategoria / Category'] || row['Category'] || row['Kategoria'] || undefined,
        sku: row['SKU'] || undefined,
        // Handle both legacy and new field names
        salesPrice: validatePrice(
          parseNumber(row['Yksikköhinta / Unit Price'] || row['Sales Price'] || row['Unit Price'] || row['Yksikköhinta']), 
          `Row ${index + 1}: Valid sales price is required`
        ),
        costPrice: parseNumber(row['Ostohinta / Cost Price'] || row['Cost Price'] || row['Ostohinta']) || undefined,
        quantityOnHand: parseNumber(row['Määrä / Quantity'] || row['Quantity'] || row['Määrä']) || 0,
        reorderLevel: parseNumber(row['Hälytysraja / Reorder Point'] || row['Reorder Point'] || row['Hälytysraja']) || undefined,
        leadTimeDays: parseNumber(row['Toimitusaika / Lead Time (Days)'] || row['Lead Time (Days)'] || row['Toimitusaika']) || undefined,
        vendorSku: row['Toimittajan SKU / Vendor SKU'] || row['Vendor SKU'] || row['Toimittajan SKU'] || undefined,
        vendorItemName: row['Toimittajan nimi / Vendor Item Name'] || row['Vendor Item Name'] || row['Toimittajan nimi'] || undefined,
        minimumStockLevel: parseNumber(row['Minimisaldo / Minimum Stock'] || row['Minimum Stock'] || row['Minimisaldo']) || 0,
        itemType: validateItemType(row['Tyyppi / Type'] || row['Type'] || row['Tyyppi']) || 'MANUFACTURED_GOOD',
        showInPricelist: validateBooleanValue(row['Hinnastossa / Show in Pricelist'] || row['Show in Pricelist'] || row['Hinnastossa']),
        // Legacy compatibility
        unitPrice: parseNumber(row['Yksikköhinta / Unit Price'] || row['Unit Price'] || row['Yksikköhinta']) || undefined,
        currentQuantity: parseNumber(row['Määrä / Quantity'] || row['Quantity'] || row['Määrä']) || undefined,
        reorderPoint: parseNumber(row['Hälytysraja / Reorder Point'] || row['Reorder Point'] || row['Hälytysraja']) || undefined,
      };
      return data;
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
    }
  });
}

// Helper functions for validation
function validateString(value: any, errorMessage: string): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(errorMessage);
  }
  return value.trim();
}

function validatePrice(value: number | null, errorMessage: string): number {
  if (value === null || value === undefined || isNaN(value) || value < 0) {
    throw new Error(errorMessage);
  }
  return value;
}

function validateLanguage(value: any): 'FI' | 'SE' | 'EN' {
  const normalized = String(value).toUpperCase();
  if (['FI', 'SE', 'EN'].includes(normalized)) {
    return normalized as 'FI' | 'SE' | 'EN';
  }
  return 'FI';
}

function validateItemType(value: any): 'RAW_MATERIAL' | 'MANUFACTURED_GOOD' {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('raaka') || normalized.includes('raw')) {
    return 'RAW_MATERIAL';
  }
  return 'MANUFACTURED_GOOD';
}

function validateBooleanValue(value: any): boolean {
  if (value === null || value === undefined || value === '') {
    return true; // Default to true for showInPricelist
  }
  
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'kyllä', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'ei', 'off'].includes(normalized)) {
    return false;
  }
  
  return true; // Default to true for unknown values
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Handle Finnish decimal separator
  const stringValue = String(value).replace(',', '.');
  const number = parseFloat(stringValue);
  
  return isNaN(number) ? null : number;
}

function getInvoiceStatusFinnish(status: string): string {
  const statusMap = {
    'draft': 'Luonnos',
    'sent': 'Lähetetty',
    'paid': 'Maksettu',
    'overdue': 'Erääntynyt',
    'cancelled': 'Peruutettu',
    'credited': 'Hyvitetty',
  };
  return statusMap[status as keyof typeof statusMap] || status;
}

function getOrderStatusFinnish(status: string): string {
  const statusMap = {
    'draft': 'Luonnos',
    'confirmed': 'Vahvistettu',
    'in_production': 'Tuotannossa',
    'shipped': 'Lähetetty',
    'delivered': 'Toimitettu',
    'invoiced': 'Laskutettu',
    'cancelled': 'Peruutettu',
  };
  return statusMap[status as keyof typeof statusMap] || status;
} 