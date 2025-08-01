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
 * Generate Finnish Giroblankett payment slip HTML with proper formatting
 */
function generateGiroblankettHtml(invoice: InvoiceWithDetails, total: any): string {
  const referenceNumber = generateReferenceNumber(invoice.invoiceNumber);
  const formattedAmount = formatCurrency(total).replace(' €', ''); // Remove currency symbol for amount field
  const dueDate = formatDate(invoice.dueDate);
  
  return `
    <div class="giroblankett-container">
      <!-- Page break before giroblankett -->
      <div class="page-break"></div>
      
      <!-- Finnish Giroblankett Payment Slip -->
      <div class="giroblankett">
        <!-- Header with perforated line indicator -->
        <div class="giroblankett-perforation">
          <div class="perforation-line"></div>
          <div class="perforation-text">LEIKKAA TÄSTÄ / KLIPP HÄR</div>
          <div class="perforation-line"></div>
        </div>
        
        <div class="giroblankett-header">
          <h2>TILISIIRTO</h2>
          <h3>GIRERING</h3>
        </div>
        
        <div class="giroblankett-content">
          <!-- Left section -->
          <div class="giroblankett-left">
            <div class="giroblankett-field">
              <div class="field-label">Saaja<br/>Mottagare</div>
              <div class="field-value recipient-name">Yritys Oy</div>
              <div class="field-value recipient-address">Yrityskatu 1</div>
              <div class="field-value recipient-city">00100 Helsinki</div>
            </div>
            
            <div class="giroblankett-field account-field">
              <div class="field-label">Saajan tilinumero<br/>Mottagarens kontonummer</div>
              <div class="field-value account-number">FI21 1234 5600 0007 85</div>
            </div>
            
            <div class="giroblankett-field">
              <div class="field-label">Maksaja<br/>Betalare</div>
              <div class="field-value payer-name">${invoice.customer.name}</div>
              <div class="field-value payer-address">${(invoice.customer as any).address || ''}</div>
              <div class="field-value payer-city">${(invoice.customer as any).postalCode || ''} ${(invoice.customer as any).city || ''}</div>
            </div>
            
            <div class="giroblankett-field signature-field">
              <div class="field-label">Maksajan allekirjoitus<br/>Betalarens underskrift</div>
              <div class="signature-line"></div>
            </div>
          </div>
          
          <!-- Right section -->
          <div class="giroblankett-right">
            <div class="giroblankett-field amount-field">
              <div class="field-label">Euro</div>
              <div class="field-value amount-value">${formattedAmount}</div>
              <div class="cents-separator"></div>
            </div>
            
            <div class="giroblankett-field reference-field">
              <div class="field-label">Viitenumero<br/>Referensnummer</div>
              <div class="field-value reference-value">${referenceNumber}</div>
            </div>
            
            <div class="giroblankett-field due-date-field">
              <div class="field-label">Eräpäivä<br/>Förfallodag</div>
              <div class="field-value due-date-value">${dueDate}</div>
            </div>
            
            <div class="giroblankett-field signature-field">
              <div class="field-label">Allekirjoitus<br/>Underskrift</div>
              <div class="signature-line"></div>
            </div>
          </div>
        </div>
        
        <!-- Machine readable section at bottom -->
        <div class="giroblankett-machine-readable">
          <div class="machine-code">
            &gt;FI21 1234 5600 0007 85&lt; ${formattedAmount.replace(',', '')}${String(referenceNumber).padStart(20, '0')}&gt;
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
    
    /* Enhanced Finnish Giroblankett Styles */
    .giroblankett-container {
      margin-top: 50px;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .giroblankett-perforation {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      font-size: 8px;
      color: #666;
    }
    
    .perforation-line {
      flex: 1;
      height: 1px;
      background: repeating-linear-gradient(
        to right,
        #666 0px,
        #666 2px,
        transparent 2px,
        transparent 4px
      );
    }
    
    .perforation-text {
      padding: 0 15px;
      white-space: nowrap;
    }
    
    .giroblankett {
      border: 2px solid #000;
      page-break-inside: avoid;
      background: white;
      font-family: 'Arial', sans-serif;
    }
    
    .giroblankett-header {
      text-align: center;
      padding: 12px;
      border-bottom: 2px solid #000;
      background-color: #f8f8f8;
    }
    
    .giroblankett-header h2 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
      letter-spacing: 1px;
    }
    
    .giroblankett-header h3 {
      font-size: 12px;
      font-weight: normal;
      color: #666;
      letter-spacing: 0.5px;
    }
    
    .giroblankett-content {
      display: flex;
      min-height: 140px;
    }
    
    .giroblankett-left,
    .giroblankett-right {
      flex: 1;
      padding: 15px;
    }
    
    .giroblankett-left {
      border-right: 2px solid #000;
    }
    
    .giroblankett-field {
      margin-bottom: 18px;
      position: relative;
    }
    
    .field-label {
      font-size: 8px;
      color: #333;
      line-height: 1.1;
      margin-bottom: 4px;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .field-value {
      font-size: 11px;
      font-weight: bold;
      color: #000;
      min-height: 14px;
      line-height: 1.2;
      padding-top: 1px;
    }
    
    .recipient-name,
    .payer-name {
      font-size: 12px;
      margin-bottom: 2px;
    }
    
    .recipient-address,
    .recipient-city,
    .payer-address,
    .payer-city {
      font-size: 10px;
      font-weight: normal;
      color: #333;
      margin-bottom: 1px;
    }
    
    .account-number {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      letter-spacing: 1px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
      padding-bottom: 2px;
    }
    
    .amount-field {
      border: 1px solid #000;
      padding: 8px;
      margin-bottom: 20px;
      background-color: #fafafa;
    }
    
    .amount-value {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      text-align: right;
      border-bottom: 1px solid #000;
      padding: 4px 2px;
      margin-top: 4px;
    }
    
    .cents-separator {
      width: 100%;
      height: 1px;
      background: #000;
      margin: 2px 0;
    }
    
    .reference-field .field-value {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 1px;
      border-bottom: 1px solid #000;
      padding: 3px 2px;
    }
    
    .due-date-field .field-value {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      border-bottom: 1px solid #000;
      padding: 3px 2px;
    }
    
    .signature-field {
      margin-top: 25px;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      height: 25px;
      margin-top: 8px;
    }
    
    .giroblankett-machine-readable {
      border-top: 1px solid #000;
      padding: 8px;
      background-color: #f0f0f0;
      text-align: center;
    }
    
    .machine-code {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      letter-spacing: 0.5px;
      color: #333;
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