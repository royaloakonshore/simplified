import type { Invoice, Order, InvoiceItem, Customer, InventoryItem } from "@prisma/client";
import puppeteer from "puppeteer";
import Decimal from "decimal.js";

type InvoiceWithDetails = Invoice & {
  customer: Customer;
  items: (InvoiceItem & {
    inventoryItem: InventoryItem;
  })[];
};

type OrderWithDetails = Order & {
  customer: Customer;
};

/**
 * Generate PDF for invoice with Finnish Giroblankett payment slip
 */
export async function generateInvoicePdf(invoice: InvoiceWithDetails): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(generateInvoiceHtml(invoice), {
      waitUntil: 'networkidle0'
    });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF for order
 */
export async function generateOrderPdf(order: OrderWithDetails): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(generateOrderHtml(order), {
      waitUntil: 'networkidle0'
    });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Generate HTML template for invoice with Finnish Giroblankett
 */
function generateInvoiceHtml(invoice: InvoiceWithDetails): string {
  const isCredit = invoice.isCreditNote;
  const documentType = isCredit ? 'HYVITYSLASKU' : 'LASKU';
  const documentTypeEn = isCredit ? 'CREDIT NOTE' : 'INVOICE';
  
  // Calculate totals
  const subtotal = invoice.items.reduce((sum, item) => {
    const itemTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    return sum.plus(itemTotal);
  }, new Decimal(0));
  
  const vatAmount = new Decimal(invoice.totalVatAmount?.toString() || '0');
  const total = new Decimal(invoice.totalAmount?.toString() || '0');
  
  return `
    <!DOCTYPE html>
    <html lang="fi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentType} ${invoice.invoiceNumber}</title>
      <style>
        ${getInvoiceStyles()}
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1 class="company-name">Yritys Oy</h1>
            <div class="company-details">
              <p>Yrityskatu 1</p>
              <p>00100 Helsinki</p>
              <p>Y-tunnus: 1234567-8</p>
              <p>ALV-nro: FI12345678</p>
            </div>
          </div>
          <div class="document-info">
            <h2 class="document-type">${documentType}</h2>
            <p class="document-type-en">${documentTypeEn}</p>
            <div class="document-details">
              <p><strong>Numero:</strong> ${invoice.invoiceNumber}</p>
              <p><strong>Päivämäärä:</strong> ${formatDate(invoice.invoiceDate)}</p>
              <p><strong>Eräpäivä:</strong> ${formatDate(invoice.dueDate)}</p>
              ${isCredit && invoice.originalInvoiceId ? `<p><strong>Alkuperäinen lasku:</strong> ${invoice.notes?.match(/lasku (\S+)/)?.[1] || ''}</p>` : ''}
            </div>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="customer-section">
          <h3>Laskutustiedot</h3>
          <div class="customer-info">
            <p><strong>${invoice.customer.name}</strong></p>
            <p>${(invoice.customer as any).address || ''}</p>
            <p>${(invoice.customer as any).postalCode || ''} ${(invoice.customer as any).city || ''}</p>
            ${invoice.customer.vatId ? `<p>Y-tunnus: ${invoice.customer.vatId}</p>` : ''}
          </div>
        </div>

        <!-- Invoice Items -->
        <div class="items-section">
          <table class="items-table">
            <thead>
              <tr>
                <th>Tuote/Palvelu</th>
                <th>Määrä</th>
                <th>Yksikköhinta</th>
                <th>ALV %</th>
                <th>Yhteensä</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => {
                const itemTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
                return `
                  <tr>
                    <td>${item.description || item.inventoryItem.name}</td>
                    <td>${formatDecimal(item.quantity)}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatDecimal(item.vatRatePercent)}%</td>
                    <td>${formatCurrency(itemTotal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-table">
            <div class="total-row">
              <span>Yhteensä (veroton):</span>
              <span>${formatCurrency(subtotal.minus(vatAmount))}</span>
            </div>
            <div class="total-row">
              <span>Arvonlisävero:</span>
              <span>${formatCurrency(vatAmount)}</span>
            </div>
            <div class="total-row total-final">
              <span><strong>Loppusumma:</strong></span>
              <span><strong>${formatCurrency(total)}</strong></span>
            </div>
          </div>
        </div>

        ${!isCredit ? generateGiroblankettHtml(invoice, total) : ''}
        
        <!-- Footer -->
        <div class="footer">
          <p>Kiitos tilauksestanne!</p>
          <p>Maksuehto: ${invoice.dueDate ? Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)) : 14} päivää netto</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate Finnish Giroblankett payment slip HTML
 */
function generateGiroblankettHtml(invoice: InvoiceWithDetails, total: any): string {
  const referenceNumber = generateReferenceNumber(invoice.invoiceNumber);
  
  return `
    <div class="giroblankett">
      <div class="giroblankett-header">
        <h3>TILISIIRTO / GIRERING</h3>
      </div>
      
      <div class="giroblankett-content">
        <div class="giroblankett-left">
          <div class="field">
            <label>Saaja / Mottagare:</label>
            <div class="value">Yritys Oy</div>
          </div>
          
          <div class="field">
            <label>Saajan tilinumero / Mottagarens kontonummer:</label>
            <div class="value bank-account">FI21 1234 5600 0007 85</div>
          </div>
          
          <div class="field">
            <label>Maksaja / Betalare:</label>
            <div class="value">${invoice.customer.name}</div>
          </div>
          
          <div class="field">
            <label>Maksajan allekirjoitus / Betalarens underskrift:</label>
            <div class="signature-line"></div>
          </div>
        </div>
        
        <div class="giroblankett-right">
          <div class="field">
            <label>Euro:</label>
            <div class="value amount">${formatCurrency(total)}</div>
          </div>
          
          <div class="field">
            <label>Viitenumero / Referensnummer:</label>
            <div class="value reference">${referenceNumber}</div>
          </div>
          
          <div class="field">
            <label>Eräpäivä / Förfallodag:</label>
            <div class="value">${formatDate(invoice.dueDate)}</div>
          </div>
          
          <div class="field">
            <label>Allekirjoitus / Underskrift:</label>
            <div class="signature-line"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate HTML template for order
 */
function generateOrderHtml(order: OrderWithDetails): string {
  return `
    <!DOCTYPE html>
    <html lang="fi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tilaus ${order.orderNumber}</title>
      <style>
        ${getInvoiceStyles()}
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-info">
            <h1 class="company-name">Yritys Oy</h1>
          </div>
          <div class="document-info">
            <h2 class="document-type">TILAUS</h2>
            <p class="document-type-en">ORDER</p>
            <div class="document-details">
              <p><strong>Numero:</strong> ${order.orderNumber}</p>
              <p><strong>Päivämäärä:</strong> ${formatDate(order.orderDate)}</p>
            </div>
          </div>
        </div>
        
        <div class="customer-section">
          <h3>Asiakastiedot</h3>
          <div class="customer-info">
            <p><strong>${order.customer.name}</strong></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * CSS styles for invoice PDF
 */
function getInvoiceStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
    }
    
    .company-name {
      font-size: 24px;
      color: #0066cc;
      margin-bottom: 10px;
    }
    
    .company-details p {
      margin-bottom: 2px;
      font-size: 11px;
    }
    
    .document-type {
      font-size: 20px;
      color: #0066cc;
      text-align: right;
      margin-bottom: 5px;
    }
    
    .document-type-en {
      font-size: 12px;
      color: #666;
      text-align: right;
      margin-bottom: 15px;
    }
    
    .document-details p {
      text-align: right;
      margin-bottom: 3px;
    }
    
    .customer-section {
      margin-bottom: 30px;
    }
    
    .customer-section h3 {
      color: #0066cc;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .customer-info p {
      margin-bottom: 2px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table th,
    .items-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    
    .items-table th {
      background-color: #f5f5f5;
      font-weight: bold;
      color: #0066cc;
    }
    
    .items-table td:nth-child(2),
    .items-table td:nth-child(3),
    .items-table td:nth-child(4),
    .items-table td:nth-child(5) {
      text-align: right;
    }
    
    .totals-section {
      margin-bottom: 40px;
    }
    
    .totals-table {
      width: 300px;
      margin-left: auto;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #eee;
    }
    
    .total-final {
      border-bottom: 2px solid #0066cc;
      border-top: 2px solid #0066cc;
      font-size: 14px;
      padding: 10px 0;
    }
    
    .giroblankett {
      border: 2px solid #000;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    
    .giroblankett-header {
      background-color: #f0f0f0;
      padding: 10px;
      text-align: center;
      border-bottom: 1px solid #000;
    }
    
    .giroblankett-header h3 {
      font-size: 14px;
      font-weight: bold;
    }
    
    .giroblankett-content {
      display: flex;
      min-height: 120px;
    }
    
    .giroblankett-left,
    .giroblankett-right {
      flex: 1;
      padding: 15px;
    }
    
    .giroblankett-left {
      border-right: 1px solid #000;
    }
    
    .field {
      margin-bottom: 15px;
    }
    
    .field label {
      display: block;
      font-size: 9px;
      color: #666;
      margin-bottom: 3px;
    }
    
    .field .value {
      font-size: 11px;
      font-weight: bold;
      min-height: 16px;
    }
    
    .bank-account {
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    
    .amount {
      font-size: 14px;
      text-align: right;
    }
    
    .reference {
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      height: 20px;
      margin-top: 5px;
    }
    
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    
    .footer p {
      margin-bottom: 5px;
    }
    
    @media print {
      .invoice-container {
        margin: 0;
        padding: 0;
      }
    }
  `;
}

/**
 * Generate Finnish reference number (viitenumero)
 */
function generateReferenceNumber(invoiceNumber: string): string {
  // Extract numeric part from invoice number
  const numericPart = invoiceNumber.replace(/\D/g, '');
  
  // Calculate check digit using Finnish algorithm
  const weights = [7, 3, 1];
  let sum = 0;
  
  for (let i = 0; i < numericPart.length; i++) {
    const digit = parseInt(numericPart[numericPart.length - 1 - i]);
    const weight = weights[i % 3];
    sum += digit * weight;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return numericPart + checkDigit.toString();
}

/**
 * Format date for Finnish locale
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('fi-FI');
}

/**
 * Format currency for Finnish locale
 */
function formatCurrency(amount: any): string {
  const decimal = new Decimal(amount);
  return decimal.toFixed(2).replace('.', ',') + ' €';
}

/**
 * Format decimal number for Finnish locale
 */
function formatDecimal(amount: any): string {
  const decimal = new Decimal(amount);
  return decimal.toString().replace('.', ',');
} 