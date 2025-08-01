import * as XLSX from 'xlsx';
import type { 
  Customer, 
  Invoice, 
  InvoiceItem, 
  Order, 
  OrderItem, 
  InventoryItem,
  InventoryCategory
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

export type ExcelInventoryData = {
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  unitPrice: number;
  currentQuantity?: number;
  reorderPoint?: number;
  itemType?: 'RAW_MATERIAL' | 'MANUFACTURED_GOOD';
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
 * Export inventory items to Excel
 */
export function exportInventoryToExcel(items: (InventoryItem & { inventoryCategory?: InventoryCategory | null })[]): Buffer {
  const worksheetData = items.map(item => ({
    'Nimi / Name': item.name,
    'Kuvaus / Description': item.description || '',
    'Kategoria / Category': item.inventoryCategory?.name || '',
    'SKU': item.sku || '',
    'Yksikköhinta / Unit Price': item.salesPrice.toString().replace('.', ','),
    'Määrä / Quantity': item.quantityOnHand?.toString() || '0',
    'Hälytysraja / Reorder Point': item.reorderLevel?.toString() || '',
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
    { wch: 12 }, // Unit Price
    { wch: 10 }, // Quantity
    { wch: 12 }, // Reorder Point
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
 * Import inventory items from Excel file
 */
export function importInventoryFromExcel(fileBuffer: Buffer): ExcelInventoryData[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
  
  return jsonData.map((row, index) => {
    try {
      return {
        name: validateString(row['Nimi / Name'] || row['Name'] || row['Nimi'], `Row ${index + 1}: Name is required`),
        description: row['Kuvaus / Description'] || row['Description'] || row['Kuvaus'] || undefined,
        category: row['Kategoria / Category'] || row['Category'] || row['Kategoria'] || undefined,
        sku: row['SKU'] || undefined,
        unitPrice: validatePrice(parseNumber(row['Yksikköhinta / Unit Price'] || row['Unit Price'] || row['Yksikköhinta']), `Row ${index + 1}: Valid unit price is required`),
        currentQuantity: parseNumber(row['Määrä / Quantity'] || row['Quantity'] || row['Määrä']) || 0,
        reorderPoint: parseNumber(row['Hälytysraja / Reorder Point'] || row['Reorder Point'] || row['Hälytysraja']) || undefined,
        itemType: validateItemType(row['Tyyppi / Type'] || row['Type'] || row['Tyyppi']) || 'MANUFACTURED_GOOD',
      };
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