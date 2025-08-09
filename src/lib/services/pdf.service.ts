import type { Invoice, Order, InvoiceItem, OrderItem, Customer, InventoryItem, Address, Company } from "@prisma/client";
import { CustomerLanguage, AddressType } from "@prisma/client";
import puppeteer from "puppeteer";
import Decimal from "decimal.js";
import QRCode from "qrcode";

type InvoiceWithDetails = Invoice & {
  customer: Customer & {
    addresses: Address[];
  };
  company?: Company; // Make company optional for now
  items: (InvoiceItem & {
    inventoryItem: InventoryItem;
  })[];
};

type OrderWithDetails = Order & {
  customer: Customer & {
    addresses: Address[];
  };
  company?: Company; // Make company optional for now
  items: (OrderItem & {
    inventoryItem: InventoryItem;
  })[];
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
    await page.setContent(await generateOrderHtml(order), {
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
  const subtotal = invoice.items.reduce((sum, item) => {
    const itemTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    return sum.plus(itemTotal);
  }, new Decimal(0));
  
  const vatAmount = new Decimal(invoice.totalVatAmount?.toString() || '0');
  const total = new Decimal(invoice.totalAmount?.toString() || '0');
  
  // Get customer language for localization
  const customerLanguage = invoice.customer?.language || CustomerLanguage.FI;
  const isEnglish = customerLanguage === CustomerLanguage.EN;
  
  // Get billing address from customer addresses
  const billingAddress = invoice.customer?.addresses?.find(addr => addr.type === AddressType.billing) 
    || invoice.customer?.addresses?.[0];
  
  // Determine document type - check if it's a reminder
  const isReminder = invoice.status === 'overdue' || invoice.status === 'sent';
  const documentType = isReminder ? 'HUOMAUTUS' : 'LASKU';
  const documentTypeEn = isReminder ? 'REMINDER' : 'INVOICE';
  
  return `
    <!DOCTYPE html>
    <html lang="${customerLanguage.toLowerCase()}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentType} ${invoice.invoiceNumber}</title>
      <style>
        ${getEnhancedInvoiceStyles()}
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header Section - Company Info and Document Type -->
        <div class="header-section">
          <div class="company-info">
            <h1>${invoice.company?.name || 'Yritys Oy'}</h1>
            <p>${(invoice.company as any)?.streetAddress || 'Yrityskatu 1'}</p>
            <p>${(invoice.company as any)?.postalCode || '00100'} ${(invoice.company as any)?.city || 'Helsinki'}</p>
            <p>Y-tunnus: ${(invoice.company as any)?.businessId || '1234567-8'}</p>
            <p>ALV-nro: ${(invoice.company as any)?.vatId || 'FI12345678'}</p>
          </div>
          <div class="document-type">
            <h2>${documentType}</h2>
            <p class="document-type-en">${documentTypeEn}</p>
          </div>
        </div>

        <!-- Customer and Invoice Details Section -->
        <div class="details-section">
          <div class="details-content">
            <!-- Customer Information -->
            <div class="customer-info">
              <h3>${isEnglish ? 'Billing Information' : 'Laskutustiedot'}</h3>
              <div>
                <p><strong>${invoice.customer?.name}</strong></p>
                ${billingAddress?.streetAddress ? `<p>${billingAddress.streetAddress}</p>` : ''}
                ${billingAddress?.postalCode && billingAddress?.city ? 
                  `<p>${billingAddress.postalCode} ${billingAddress.city}</p>` : ''}
                ${invoice.customer?.vatId ? 
                  `<p>${isEnglish ? 'VAT' : 'ALV'}: ${invoice.customer.vatId}</p>` : ''}
              </div>
            </div>

            <!-- Invoice Information -->
            <div class="invoice-info">
              <table class="info-table">
                <tr>
                  <td>${isEnglish ? 'Invoice Number' : 'Laskun numero'}:</td>
                  <td><strong>${invoice.invoiceNumber}</strong></td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Invoice Date' : 'Laskun päivämäärä'}:</td>
                  <td>${invoice.invoiceDate.toLocaleDateString(isEnglish ? 'en-US' : 'fi-FI')}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Due Date' : 'Eräpäivä'}:</td>
                  <td>${invoice.dueDate.toLocaleDateString(isEnglish ? 'en-US' : 'fi-FI')}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Payment Terms' : 'Maksuaika'}:</td>
                  <td>${invoice.paymentTermsDays || 14} ${isEnglish ? 'days' : 'päivää'}</td>
                </tr>
                ${invoice.referenceNumber ? `
                <tr>
                  <td>${isEnglish ? 'Reference Number' : 'Viitenumero'}:</td>
                  <td>${invoice.referenceNumber}</td>
                </tr>
                ` : ''}
                ${invoice.customer.buyerReference ? `
                <tr>
                  <td>${isEnglish ? 'Customer Reference' : 'Asiakasviite'}:</td>
                  <td>${invoice.customer.buyerReference}</td>
                </tr>
                ` : ''}
                ${invoice.ourReference ? `
                <tr>
                  <td>${isEnglish ? 'Our Reference' : 'Viitteemme'}:</td>
                  <td>${invoice.ourReference}</td>
                </tr>
                ` : ''}
                ${invoice.deliveryDate ? `
                <tr>
                  <td>${isEnglish ? 'Delivery Date' : 'Toimituspäivä'}:</td>
                  <td>${invoice.deliveryDate.toLocaleDateString(isEnglish ? 'en-US' : 'fi-FI')}</td>
                </tr>
                ` : ''}
                ${invoice.deliveryMethod ? `
                <tr>
                  <td>${isEnglish ? 'Delivery Method' : 'Toimitustapa'}:</td>
                  <td>${invoice.deliveryMethod}</td>
                </tr>
                ` : ''}
                ${invoice.complaintPeriod ? `
                <tr>
                  <td>${isEnglish ? 'Complaint Period' : 'Huomautusaika'}:</td>
                  <td>${invoice.complaintPeriod}</td>
                </tr>
                ` : ''}
                ${invoice.penaltyInterest ? `
                <tr>
                  <td>${isEnglish ? 'Penalty Interest' : 'Viivästyskorko'}:</td>
                  <td>${invoice.penaltyInterest}%</td>
                </tr>
                ` : ''}
              </table>
            </div>
          </div>
        </div>

        <!-- Items Table - Enhanced to match invoice details page -->
        <div class="items-section">
          <h3 class="items-title">${isEnglish ? 'Invoice Items' : 'Laskurivit'}</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 12%;">SKU</th>
                <th style="text-align: left; width: 28%;">${isEnglish ? 'Description' : 'Kuvaus'}</th>
                <th style="text-align: right; width: 8%;">${isEnglish ? 'Qty' : 'Määrä'}</th>
                <th style="text-align: right; width: 10%;">${isEnglish ? 'Unit Price' : 'Yksikköhinta'}</th>
                <th style="text-align: right; width: 10%;">${isEnglish ? 'Discount' : 'Alennus'}</th>
                <th style="text-align: right; width: 6%;">${isEnglish ? 'VAT %' : 'ALV %'}</th>
                <th style="text-align: right; width: 10%;">${isEnglish ? 'Net Amount' : 'Netto'}</th>
                <th style="text-align: right; width: 8%;">${isEnglish ? 'VAT Amount' : 'ALV'}</th>
                <th style="text-align: right; width: 10%;">${isEnglish ? 'Total' : 'Yhteensä'}</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => {
                const quantity = new Decimal(item.quantity.toString());
                const unitPrice = new Decimal(item.unitPrice.toString());
                const discountAmount = new Decimal(item.discountAmount?.toString() || '0');
                const discountPercentage = new Decimal(item.discountPercentage?.toString() || '0');
                const vatRate = new Decimal(item.vatRatePercent?.toString() || '24');
                
                // Calculate amounts like in invoice details page
                const grossAmount = quantity.times(unitPrice);
                const totalDiscount = discountAmount.plus(grossAmount.times(discountPercentage).div(100));
                const netAmount = grossAmount.minus(totalDiscount);
                const vatAmount = netAmount.times(vatRate).div(100);
                const totalAmount = netAmount.plus(vatAmount);
                
                return `
                  <tr>
                    <td style="text-align: left; white-space: nowrap;">${item.inventoryItem?.sku || '-'}</td>
                    <td>
                      <div class="item-description">
                        <strong>${item.inventoryItem?.name || item.description || ''}</strong>
                        ${item.description && item.inventoryItem?.name !== item.description ? 
                          `<br><small class="item-detail">${item.description}</small>` : ''}
                        ${item.rowFreeText ? `<br><small class="item-detail">${item.rowFreeText}</small>` : ''}
                      </div>
                    </td>
                    <td style="text-align: right;">${formatDecimal(quantity, 2)}</td>
                    <td style="text-align: right; white-space: nowrap;">${formatCurrency(unitPrice)}</td>
                    <td style="text-align: right;">
                      ${totalDiscount.greaterThan(0) ? `
                        <div class="discount-info">
                          ${discountAmount.greaterThan(0) ? `-${formatCurrency(discountAmount)}` : ''}
                          ${discountAmount.greaterThan(0) && discountPercentage.greaterThan(0) ? '<br>' : ''}
                          ${discountPercentage.greaterThan(0) ? `-${formatDecimal(discountPercentage, 1)}%` : ''}
                        </div>
                      ` : '-'}
                    </td>
                    <td style="text-align: right;">${formatDecimal(vatRate, 1)} %</td>
                    <td style="text-align: right; white-space: nowrap;">${formatCurrency(netAmount)}</td>
                    <td style="text-align: right; white-space: nowrap;">${formatCurrency(vatAmount)}</td>
                    <td style="text-align: right; white-space: nowrap;"><strong>${formatCurrency(totalAmount)}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Enhanced Totals Section -->
          <div class="totals-section">
            <div class="vat-summary">
              ${(() => {
                const vatSummary: Record<string, { netAmount: number; vatAmount: number }> = {};
                
                invoice.items.forEach((item: any) => {
                  const vatRate = item.vatRatePercent?.toString() || '24';
                  const quantity = Number(item.quantity);
                  const unitPrice = Number(item.unitPrice);
                  const discountAmount = Number(item.discountAmount || 0);
                  const discountPercentage = Number(item.discountPercentage || 0);
                  
                  const grossAmount = quantity * unitPrice;
                  const totalDiscount = discountAmount + (grossAmount * discountPercentage / 100);
                  const netAmount = grossAmount - totalDiscount;
                  const vatAmount = netAmount * (Number(vatRate) / 100);
                  
                  if (!vatSummary[vatRate]) {
                    vatSummary[vatRate] = { netAmount: 0, vatAmount: 0 };
                  }
                  vatSummary[vatRate].netAmount += netAmount;
                  vatSummary[vatRate].vatAmount += vatAmount;
                });

                return Object.entries(vatSummary).map(([rate, amounts]) => `
                  <div class="vat-summary-row">
                    <span>${isEnglish ? 'VAT' : 'ALV'} ${formatDecimal(Number(rate), 1)}% ${isEnglish ? 'on' : 'summasta'} ${formatCurrency(amounts.netAmount)}:</span>
                    <span class="vat-amount">${formatCurrency(amounts.vatAmount)}</span>
                  </div>
                `).join('');
              })()}
            </div>
            
            <table class="totals-table">
              <tr class="total-row">
                <td><strong>${isEnglish ? 'Total Amount' : 'Loppusumma'}:</strong></td>
                <td><strong>${formatCurrency(total)}</strong></td>
              </tr>
            </table>
          </div>
        </div>

        ${generateGiroblankettHtml(invoice, isEnglish)}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate Finnish Giroblankett payment slip
 */
function generateGiroblankettHtml(invoice: InvoiceWithDetails, isEnglish: boolean): string {
  const total = new Decimal(invoice.totalAmount?.toString() || '0');
  
  // Get billing address from customer addresses
  const billingAddress = invoice.customer?.addresses?.find(addr => addr.type === AddressType.billing) 
    || invoice.customer?.addresses?.[0];
  
  return `
    <!-- Company Details Footer -->
    <div style="display: flex; margin-bottom: 1em; font-size: 0.8em;">
      <div style="width: 33%;">
        <div><strong>${invoice.company?.name || 'Yritys Oy'}</strong></div>
        <div>${(invoice.company as any)?.streetAddress || 'Yrityskatu 1'}</div>
        <div>${(invoice.company as any)?.postalCode || '00100'} ${(invoice.company as any)?.city || 'Helsinki'}</div>
      </div>
      <div style="width: 33%;">
        <div>${(invoice.company as any)?.phone ? `${isEnglish ? 'Phone' : 'Puhelin'}: ${(invoice.company as any).phone}` : ''}</div>
        <div>${(invoice.company as any)?.email ? `${isEnglish ? 'Email' : 'Sähköposti'}: ${(invoice.company as any).email}` : ''}</div>
        <div>${(invoice.company as any)?.website ? `${isEnglish ? 'Website' : 'Verkkosivu'}: ${(invoice.company as any).website}` : ''}</div>
      </div>
      <div style="width: 34%;">
        <div>${(invoice.company as any)?.city ? `${isEnglish ? 'Domicile' : 'Kotipaikka'}: ${(invoice.company as any).city}` : ''}</div>
        <div>${isEnglish ? 'Business ID' : 'Y-tunnus'}: ${(invoice.company as any)?.businessId || '1234567-8'}</div>
      </div>
    </div>

    <!-- Giroblankett Payment Slip -->
    <div style="border-top: 1px dashed gray; padding-top: 0.5em;">
      <div style="display: flex; border: 2px solid black;">
        <!-- Left side - Recipient and Payer info -->
        <div style="width: 58%; border-right: 2px solid black;">
          <!-- Recipient Account -->
          <div style="display: flex; border-bottom: 2px solid black; height: 4.9em;">
            <div style="width: 20%; border-right: 1px solid black; padding: 3px; text-align: right; font-size: 9px; line-height: 10px;">
              <div>${isEnglish ? "Recipient's account number" : "Saajan tilinumero"}</div>
            </div>
            <div style="width: 80%; padding: 0.5em; border-left: 2px solid black;">
              <div style="font-weight: bold;">
                ${(invoice.company as any)?.bankAccount ? `IBAN ${(invoice.company as any).bankAccount}` : 'IBAN FI12 3456 7890 1234 56'}
              </div>
            </div>
          </div>

          <!-- Recipient -->
          <div style="display: flex; border-bottom: 2px solid black; height: 4.5em;">
            <div style="width: 20%; border-right: 1px solid black; padding: 3px; text-align: right; font-size: 9px; line-height: 10px;">
              <div>${isEnglish ? 'Recipient' : 'Saaja'}</div>
            </div>
            <div style="width: 80%; padding: 0.5em; border-left: 2px solid black; font-size: 0.8em;">
              <div><strong>${invoice.company?.name || 'Yritys Oy'}</strong></div>
              <div>${(invoice.company as any)?.streetAddress || 'Yrityskatu 1'}</div>
              <div>${(invoice.company as any)?.postalCode || '00100'} ${(invoice.company as any)?.city || 'Helsinki'}</div>
            </div>
          </div>

          <!-- Payer -->
          <div style="display: flex; height: 6em;">
            <div style="width: 20%; border-right: 1px solid black; padding: 3px; text-align: right; font-size: 9px; line-height: 10px;">
              <div>${isEnglish ? 'Payer' : 'Maksaja'}</div>
            </div>
            <div style="width: 80%; padding: 0.5em; border-left: 2px solid black; font-size: 0.8em;">
              <div><strong>${invoice.customer?.name || ''}</strong></div>
              ${billingAddress ? `
                <div>${billingAddress.streetAddress}</div>
                <div>${billingAddress.postalCode} ${billingAddress.city}</div>
              ` : ''}
            </div>
          </div>

          <!-- Signature and Account -->
          <div style="display: flex; border-top: 2px solid black;">
            <div style="width: 50%; border-right: 1px solid black; height: 2.5em;">
              <div style="padding: 3px; text-align: right; font-size: 9px;">
                ${isEnglish ? 'Signature' : 'Allekirjoitus'}
              </div>
              <div style="border-bottom: 1px solid black; margin: 15px 5px 5px 5px;"></div>
            </div>
            <div style="width: 50%; border-left: 1px solid black; height: 2.5em;">
              <div style="padding: 3px; text-align: right; font-size: 9px;">
                ${isEnglish ? 'From account No.' : 'Tililtä nro'}
              </div>
            </div>
          </div>
        </div>

        <!-- Right side - Payment details -->
        <div style="width: 42%;">
          <!-- QR Code space -->
          <div style="border-bottom: 2px solid black; height: 4.9em; display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 0.7em; text-align: center; color: #666;">
              ${isEnglish ? 'QR Code' : 'QR-koodi'}<br/>
              ${isEnglish ? '(Mobile payment)' : '(Mobiilimaksu)'}
            </div>
          </div>

          <!-- Invoice details -->
          <div style="border-bottom: 2px solid black; height: 10.5em; padding: 0.5em;">
            <div style="font-weight: bold; margin-bottom: 0.5em;">
              ${isEnglish ? 'Invoice Number' : 'Laskun numero'}
            </div>
            <div style="font-size: 1.1em; font-weight: bold;">
              ${invoice.invoiceNumber}
            </div>
          </div>

          <!-- Reference and Amount -->
          <div style="display: flex; border-bottom: 2px solid black;">
            <div style="width: 100%; height: 2.5em;">
              <div style="display: flex;">
                <div style="width: 30%; padding: 3px; font-size: 9px; text-align: left;">
                  ${isEnglish ? 'Reference No.' : 'Viitenro'}
                </div>
                <div style="width: 70%; border-left: 2px solid black; padding: 3px;">
                  <strong>${(invoice as any).paymentReference || ''}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Due date and Euro amount -->
          <div style="display: flex; height: 2.5em;">
            <div style="width: 50%; border-right: 1px solid black;">
              <div style="padding: 3px; font-size: 9px; text-align: left;">
                ${isEnglish ? 'Due date' : 'Eräpäivä'}
              </div>
              <div style="padding: 3px;">
                <strong>${formatDate(invoice.dueDate)}</strong>
              </div>
            </div>
            <div style="width: 50%; border-left: 1px solid black;">
              <div style="padding: 3px; font-size: 9px; text-align: center;">
                Euro
              </div>
              <div style="padding: 3px; text-align: right;">
                <strong>${formatCurrency(total)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bank barcode and payment terms -->
      <div style="display: flex; margin-top: 0.2cm;">
        <div style="width: 75%; text-align: center;">
          ${(invoice as any).bankBarcode ? `
            <div style="margin: 0 2cm;">
              <!-- Bank barcode would go here -->
              <div style="font-family: monospace; font-size: 0.8em; margin-top: 0.2cm;">
                ${(invoice as any).bankBarcode}
              </div>
            </div>
          ` : ''}
        </div>
        <div style="width: 25%; font-size: 0.7em; line-height: 1em;">
          <p style="margin: 0;">
            ${isEnglish ? 
              'The payment will be issued to the recipient under the terms of payment service and only to the account number specified by the debtor.' :
              'Maksu välitetään saajalle vain pankin maksuliikkeen ehtojen mukaisesti ja vain maksajan ilmoittamalle tilille.'
            }
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate HTML template for order PDF with different layouts for quotations vs work orders
 */
async function generateOrderHtml(order: OrderWithDetails): Promise<string> {
  const isQuotation = order.orderType === 'quotation';
  const isWorkOrder = order.orderType === 'work_order';
  
  const qrCodeSection = isWorkOrder ? await generateWorkOrderQRCode(order) : '';
  
  return `
    <!DOCTYPE html>
    <html lang="fi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${isQuotation ? 'Tarjous' : 'Työjärjestys'} ${order.orderNumber}</title>
      <style>
        ${getOrderStyles()}
      </style>
    </head>
    <body>
      <div class="order-container">
        <!-- Header Section -->
        <div class="header">
          <div class="company-info">
            <h1 class="company-name">Yritys Oy</h1>
            <p class="company-address">Yrityskatu 1<br/>00100 Helsinki<br/>Y-tunnus: 1234567-8</p>
          </div>
          <div class="document-info">
            <h2 class="document-type">${isQuotation ? 'TARJOUS' : 'TYÖJÄRJESTYS'}</h2>
            <p class="document-type-en">${isQuotation ? 'QUOTATION' : 'WORK ORDER'}</p>
            <div class="document-details">
              <p><strong>Numero:</strong> ${order.orderNumber}</p>
              <p><strong>Päivämäärä:</strong> ${formatDate(order.orderDate)}</p>
              ${order.deliveryDate ? `<p><strong>Toimituspäivä:</strong> ${formatDate(order.deliveryDate)}</p>` : ''}
              <p><strong>Tila:</strong> ${getOrderStatusText(order.status)}</p>
            </div>
          </div>
        </div>

        <!-- Customer Section -->
        <div class="customer-section">
          <h3>Asiakastiedot</h3>
          <div class="customer-info">
            <p><strong>${order.customer.name}</strong></p>
            ${order.customer.vatId ? `<p>Y-tunnus: ${order.customer.vatId}</p>` : ''}
            ${order.customer.email ? `<p>Sähköposti: ${order.customer.email}</p>` : ''}
            ${order.customer.phone ? `<p>Puhelin: ${order.customer.phone}</p>` : ''}
          </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <h3>Tilausrivit</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Tuote</th>
                <th>Määrä</th>
                <th>Yksikkö</th>
                ${isQuotation ? '<th>À-hinta</th>' : ''}
                ${isQuotation ? '<th>Alennus</th>' : ''}
                ${isQuotation ? '<th>Yhteensä</th>' : ''}
                ${isWorkOrder ? '<th>Valmistustiedot</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => generateOrderItemRow(item, isQuotation)).join('')}
            </tbody>
          </table>
        </div>

        ${isQuotation ? generateQuotationSummary(order) : ''}
        ${isWorkOrder ? generateWorkOrderInstructions(order) : ''}
        ${qrCodeSection}

        <!-- Footer -->
        <div class="footer">
          <p>Kiitos tilauksestanne!</p>
          <p>Yritys Oy | www.yritys.fi | info@yritys.fi | +358 40 123 4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate individual order item row
 */
function generateOrderItemRow(item: any, showPrices: boolean): string {
  const quantity = formatDecimal(item.quantity || 0, 2);
  const unitPrice = formatDecimal(item.unitPrice || 0, 2);
  const unit = item.inventoryItem?.unitOfMeasure || 'kpl';
  
  // Calculate line total with discounts for quotations
  let lineTotal = '';
  if (showPrices) {
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    let total = subtotal;
    
    if (item.discountPercent && item.discountPercent > 0) {
      total = subtotal * (1 - item.discountPercent / 100);
    } else if (item.discountAmount && item.discountAmount > 0) {
      total = subtotal - item.discountAmount;
    }
    
    lineTotal = formatCurrency(Math.max(0, total));
  }

  const discount = showPrices && (item.discountPercent > 0 || item.discountAmount > 0) 
    ? (item.discountPercent > 0 ? `${item.discountPercent}%` : formatCurrency(item.discountAmount))
    : '';

  return `
    <tr>
      <td>
        <strong>${item.description || item.inventoryItem?.name || 'N/A'}</strong>
        ${item.inventoryItem?.sku ? `<br/><small>SKU: ${item.inventoryItem.sku}</small>` : ''}
      </td>
      <td>${quantity}</td>
      <td>${unit}</td>
      ${showPrices ? `<td>${formatCurrency(unitPrice)}</td>` : ''}
      ${showPrices ? `<td>${discount}</td>` : ''}
      ${showPrices ? `<td><strong>${lineTotal}</strong></td>` : ''}
      ${!showPrices ? `<td><small>Tuotantotieto: ${item.inventoryItem?.itemType || 'N/A'}</small></td>` : ''}
    </tr>
  `;
}

/**
 * Generate quotation summary with pricing
 */
function generateQuotationSummary(order: any): string {
  const subtotal = order.items.reduce((sum: number, item: any) => {
    return sum + ((item.quantity || 0) * (item.unitPrice || 0));
  }, 0);
  
  const discountTotal = order.items.reduce((sum: number, item: any) => {
    let discount = 0;
    if (item.discountPercent && item.discountPercent > 0) {
      discount = ((item.quantity || 0) * (item.unitPrice || 0)) * (item.discountPercent / 100);
    } else if (item.discountAmount && item.discountAmount > 0) {
      discount = item.discountAmount;
    }
    return sum + discount;
  }, 0);

  const netTotal = subtotal - discountTotal;
  const vatTotal = netTotal * 0.255; // 25.5% Finnish VAT
  const grandTotal = netTotal + vatTotal;

  return `
    <div class="quotation-summary">
      <h3>Tarjouksen yhteenveto</h3>
      <table class="summary-table">
        <tr>
          <td>Välisumma:</td>
          <td>${formatCurrency(subtotal)}</td>
        </tr>
        ${discountTotal > 0 ? `
        <tr>
          <td>Alennus yhteensä:</td>
          <td>-${formatCurrency(discountTotal)}</td>
        </tr>` : ''}
        <tr>
          <td>Netto yhteensä:</td>
          <td>${formatCurrency(netTotal)}</td>
        </tr>
        <tr>
          <td>ALV (25,5%):</td>
          <td>${formatCurrency(vatTotal)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Loppusumma:</strong></td>
          <td><strong>${formatCurrency(grandTotal)}</strong></td>
        </tr>
      </table>
      
      <div class="quotation-terms">
        <h4>Tarjouksen ehdot</h4>
        <ul>
          <li>Tarjous voimassa 30 päivää</li>
          <li>Hinnat sisältävät alv 25,5%</li>
          <li>Maksuehto: 14 päivää netto</li>
          <li>Toimitus: ${order.deliveryDate ? formatDate(order.deliveryDate) : 'Sovittaessa'}</li>
        </ul>
      </div>
    </div>
  `;
}

/**
 * Generate work order specific instructions
 */
function generateWorkOrderInstructions(order: any): string {
  return `
    <div class="work-order-instructions">
      <h3>Tuotanto-ohjeet</h3>
      <div class="instructions-content">
        <p><strong>Työn prioriteetti:</strong> ${getPriorityText(order.deliveryDate)}</p>
        <p><strong>Toimituspäivä:</strong> ${order.deliveryDate ? formatDate(order.deliveryDate) : 'Ei määritelty'}</p>
        
        <div class="production-notes">
          <h4>Valmistushuomiot</h4>
          <ul>
            <li>Tarkista materiaalien saatavuus ennen aloitusta</li>
            <li>Noudata laatustandardeja</li>
            <li>Raportoi edistyminen tuotantojärjestelmään</li>
            <li>Ilmoita ongelmista välittömästi työnjohdolle</li>
          </ul>
        </div>
        
        <div class="safety-notice">
          <h4>Turvallisuusohjeet</h4>
          <p>Käytä asianmukaisia suojavarusteita. Noudata työturvallisuusohjeita.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate QR code section for work order status updates
 */
async function generateWorkOrderQRCode(order: any): Promise<string> {
  // Generate QR code data URL for the work order
  const qrData = `ORDER:${order.id}`;
  
  try {
    const qrCodeDataURL = await QRCode.toDataURL(qrData, { 
      errorCorrectionLevel: 'H',
      width: 150,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return `
      <div class="qr-section">
        <h3>Tilauksen seuranta</h3>
        <div class="qr-container">
          <div class="qr-code-visual">
            <img src="${qrCodeDataURL}" alt="QR Code for ${order.orderNumber}" style="width: 100px; height: 100px;" />
            <p><small>QR-koodi: ${qrData}</small></p>
            <p><small>Skannaa päivittääksesi tilauksen tila</small></p>
          </div>
          <div class="qr-instructions">
            <h4>Ohjeet:</h4>
            <ol>
              <li>Skannaa QR-koodi mobiililaitteella</li>
              <li>Päivitä työn tila sovelluksessa</li>
              <li>Lisää kommentteja tarvittaessa</li>
            </ol>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Fallback to text-based QR code reference
    return `
      <div class="qr-section">
        <h3>Tilauksen seuranta</h3>
        <div class="qr-container">
          <div class="qr-code-placeholder">
            <p>QR-koodi: ${qrData}</p>
            <p><small>Skannaa päivittääksesi tilauksen tila</small></p>
          </div>
          <div class="qr-instructions">
            <h4>Ohjeet:</h4>
            <ol>
              <li>Skannaa QR-koodi mobiililaitteella</li>
              <li>Päivitä työn tila sovelluksessa</li>
              <li>Lisää kommentteja tarvittaessa</li>
            </ol>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Generate QR code for work order status updates
 */
async function generateWorkOrderQR(orderId: string): Promise<string> {
  try {
    const qrData = `ORDER:${orderId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

/**
 * Generate HTML template for work order (no pricing, includes QR code)
 */
async function generateWorkOrderHtml(order: OrderWithDetails): Promise<string> {
  const documentType = 'TYÖTILAUS';
  const documentTypeEn = 'WORK ORDER';
  
  // Get customer language for localization
  const customerLanguage = order.customer?.language || CustomerLanguage.FI;
  const isEnglish = customerLanguage === CustomerLanguage.EN;
  
  // Get billing address from customer addresses
  const billingAddress = order.customer?.addresses?.find(addr => addr.type === AddressType.billing) 
    || order.customer?.addresses?.[0];
  
  // Generate QR code for mobile status updates
  const qrCodeDataUrl = await generateWorkOrderQR(order.id);
  
  return `
    <!DOCTYPE html>
    <html lang="${customerLanguage.toLowerCase()}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentType} ${order.orderNumber}</title>
      <style>
        ${getWorkOrderStyles()}
      </style>
    </head>
    <body>
      <div class="work-order-container">
        <!-- Header Section -->
        <div class="header-section">
          <div class="header-content">
            <div class="company-info">
              <h1>${order.company?.name || 'Yritys Oy'}</h1>
              <p>Yrityskatu 1</p>
              <p>00100 Helsinki, Finland</p>
              <p>${isEnglish ? 'Phone' : 'Puhelin'}: +358 9 123 4567</p>
            </div>
            <div class="document-type">
              <h2>${documentType}</h2>
              <p class="document-type-en">${documentTypeEn}</p>
            </div>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-section">
          <div class="details-content">
            <!-- Customer Information -->
            <div class="customer-info">
              <h3>${isEnglish ? 'Customer Information' : 'Asiakastiedot'}</h3>
              <div>
                <p><strong>${order.customer.name}</strong></p>
                ${billingAddress ? `
                  <p>${billingAddress.streetAddress}</p>
                  <p>${billingAddress.postalCode} ${billingAddress.city}</p>
                ` : ''}
                ${order.customer.email ? `<p>${isEnglish ? 'Email' : 'Sähköposti'}: ${order.customer.email}</p>` : ''}
                ${order.customer.phone ? `<p>${isEnglish ? 'Phone' : 'Puhelin'}: ${order.customer.phone}</p>` : ''}
                ${order.customer.vatId ? 
                  `<p>${isEnglish ? 'VAT' : 'ALV'}: ${order.customer.vatId}</p>` : ''}
              </div>
            </div>

            <!-- Work Order Information -->
            <div class="order-info">
              <h3>${isEnglish ? 'Work Order Details' : 'Työtilauksen tiedot'}</h3>
              <table class="info-table">
                <tr>
                  <td>${isEnglish ? 'Order Number' : 'Tilausnumero'}:</td>
                  <td>${order.orderNumber}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Order Date' : 'Tilauspäivä'}:</td>
                  <td>${new Date(order.createdAt).toLocaleDateString(customerLanguage === CustomerLanguage.EN ? 'en-US' : 'fi-FI')}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Delivery Date' : 'Toimituspäivä'}:</td>
                  <td>${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString(customerLanguage === CustomerLanguage.EN ? 'en-US' : 'fi-FI') : '-'}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Status' : 'Tila'}:</td>
                  <td>${order.status.replace('_', ' ').toUpperCase()}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <h3>${isEnglish ? 'Items' : 'Tuotteet'}</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>${isEnglish ? 'Item' : 'Tuote'}</th>
                <th>${isEnglish ? 'Description' : 'Kuvaus'}</th>
                <th>${isEnglish ? 'Quantity' : 'Määrä'}</th>
                <th>${isEnglish ? 'Unit' : 'Yksikkö'}</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.inventoryItem.sku}</td>
                  <td>${item.inventoryItem.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.inventoryItem.unitOfMeasure || 'kpl'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- QR Code Section for Mobile Status Updates -->
        <div class="qr-section">
          <h3>${isEnglish ? 'Mobile Status Update' : 'Mobiili tilapäivitys'}</h3>
          <p>${isEnglish ? 'Scan this QR code with your phone to update order status:' : 'Skannaa tämä QR-koodi puhelimellasi päivittääksesi tilauksen tilan:'}</p>
          ${qrCodeDataUrl ? `
            <div class="qr-code-container">
              <img src="${qrCodeDataUrl}" alt="QR Code for order status update" class="qr-code" />
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <div class="footer-content">
            <div style="width: 50%;">
              <div><strong>${order.company?.name || 'Yritys Oy'}</strong></div>
              <div>Yrityskatu 1</div>
              <div>00100 Helsinki</div>
            </div>
            <div style="width: 50%;">
              <div>${isEnglish ? 'Phone' : 'Puhelin'}: +358 9 123 4567</div>
              <div>${isEnglish ? 'Email' : 'Sähköposti'}: info@yritys.fi</div>
              <div>${isEnglish ? 'Business ID' : 'Y-tunnus'}: 1234567-8</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML template for quotation (includes pricing)
 */
function generateQuotationHtml(order: OrderWithDetails): string {
  const documentType = 'TARJOUS';
  const documentTypeEn = 'QUOTATION';
  
  // Get customer language for localization
  const customerLanguage = order.customer?.language || CustomerLanguage.FI;
  const isEnglish = customerLanguage === CustomerLanguage.EN;
  
  // Get billing address from customer addresses
  const billingAddress = order.customer?.addresses?.find(addr => addr.type === AddressType.billing) 
    || order.customer?.addresses?.[0];
  
  // Calculate totals
  const subtotal = order.items.reduce((sum, item) => {
    const itemTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    return sum.plus(itemTotal);
  }, new Decimal(0));
  
  const vatAmount = new Decimal((order as any).totalVatAmount?.toString() || '0');
  const total = new Decimal(order.totalAmount?.toString() || '0');
  
  return `
    <!DOCTYPE html>
    <html lang="${customerLanguage.toLowerCase()}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${documentType} ${order.orderNumber}</title>
      <style>
        ${getQuotationStyles()}
      </style>
    </head>
    <body>
      <div class="quotation-container">
        <!-- Header Section -->
        <div class="header-section">
          <div class="header-content">
            <div class="company-info">
              <h1>${order.company?.name || 'Yritys Oy'}</h1>
              <p>Yrityskatu 1</p>
              <p>00100 Helsinki, Finland</p>
              <p>${isEnglish ? 'Phone' : 'Puhelin'}: +358 9 123 4567</p>
            </div>
            <div class="document-type">
              <h2>${documentType}</h2>
              <p class="document-type-en">${documentTypeEn}</p>
            </div>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-section">
          <div class="details-content">
            <!-- Customer Information -->
            <div class="customer-info">
              <h3>${isEnglish ? 'Customer Information' : 'Asiakastiedot'}</h3>
              <div>
                <p><strong>${order.customer.name}</strong></p>
                ${billingAddress ? `
                  <p>${billingAddress.streetAddress}</p>
                  <p>${billingAddress.postalCode} ${billingAddress.city}</p>
                ` : ''}
                ${order.customer.email ? `<p>${isEnglish ? 'Email' : 'Sähköposti'}: ${order.customer.email}</p>` : ''}
                ${order.customer.phone ? `<p>${isEnglish ? 'Phone' : 'Puhelin'}: ${order.customer.phone}</p>` : ''}
                ${order.customer.vatId ? 
                  `<p>${isEnglish ? 'VAT' : 'ALV'}: ${order.customer.vatId}</p>` : ''}
              </div>
            </div>

            <!-- Quotation Information -->
            <div class="order-info">
              <h3>${isEnglish ? 'Quotation Details' : 'Tarjouksen tiedot'}</h3>
              <table class="info-table">
                <tr>
                  <td>${isEnglish ? 'Order Number' : 'Tilausnumero'}:</td>
                  <td>${order.orderNumber}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Order Date' : 'Tilauspäivä'}:</td>
                  <td>${new Date(order.createdAt).toLocaleDateString(customerLanguage === CustomerLanguage.EN ? 'en-US' : 'fi-FI')}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Delivery Date' : 'Toimituspäivä'}:</td>
                  <td>${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString(customerLanguage === CustomerLanguage.EN ? 'en-US' : 'fi-FI') : '-'}</td>
                </tr>
                <tr>
                  <td>${isEnglish ? 'Payment Terms' : 'Maksuehdot'}:</td>
                  <td>${(order as any).paymentTerms || '14 days'}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <h3>${isEnglish ? 'Items' : 'Tuotteet'}</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>${isEnglish ? 'Item' : 'Tuote'}</th>
                <th>${isEnglish ? 'Description' : 'Kuvaus'}</th>
                <th>${isEnglish ? 'Quantity' : 'Määrä'}</th>
                <th>${isEnglish ? 'Unit Price' : 'Yksikköhinta'}</th>
                <th>${isEnglish ? 'Total' : 'Yhteensä'}</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => {
                const itemTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
                return `
                  <tr>
                    <td>${item.inventoryItem.sku}</td>
                    <td>${item.inventoryItem.name}</td>
                    <td>${item.quantity}</td>
                    <td>${new Decimal(item.unitPrice.toString()).toFixed(2)} €</td>
                    <td>${itemTotal.toFixed(2)} €</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals Section -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td>${isEnglish ? 'Subtotal' : 'Välisumma'}:</td>
              <td>${subtotal.toFixed(2)} €</td>
            </tr>
            <tr>
              <td>${isEnglish ? 'VAT' : 'ALV'} ${order.items[0]?.vatRatePercent?.toString() || '24'} %:</td>
              <td>${vatAmount.toFixed(2)} €</td>
            </tr>
            <tr class="total-row">
              <td><strong>${isEnglish ? 'Total' : 'Yhteensä'}:</strong></td>
              <td><strong>${total.toFixed(2)} €</strong></td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <div class="footer-content">
            <div style="width: 50%;">
              <div><strong>${order.company?.name || 'Yritys Oy'}</strong></div>
              <div>${(order.company as any)?.streetAddress || 'Yrityskatu 1'}</div>
              <div>${(order.company as any)?.postalCode || '00100'} ${(order.company as any)?.city || 'Helsinki'}</div>
            </div>
            <div style="width: 50%;">
              <div>${(order.company as any)?.phone ? `${isEnglish ? 'Phone' : 'Puhelin'}: ${(order.company as any).phone}` : ''}</div>
              <div>${(order.company as any)?.email ? `${isEnglish ? 'Email' : 'Sähköposti'}: ${(order.company as any).email}` : ''}</div>
              <div>${isEnglish ? 'Business ID' : 'Y-tunnus'}: ${(order.company as any)?.businessId || '1234567-8'}</div>
            </div>
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
function getEnhancedInvoiceStyles(): string {
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
    
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
    }
    
    .company-info {
      text-align: left;
      flex: 1;
    }
    
    .company-info h1 {
      font-size: 24px;
      color: #0066cc;
      margin-bottom: 10px;
    }
    
    .company-info p {
      margin-bottom: 2px;
      font-size: 11px;
    }
    
    .document-type {
      text-align: right;
      font-weight: bold;
      flex-shrink: 0;
      margin-left: 20px;
    }
    
    .document-type h2 {
      font-size: 28px;
      margin: 0;
      color: #0066cc;
      font-weight: bold;
    }
    
    .document-type p {
      font-size: 14px;
      color: #666;
      margin: 0;
      margin-top: 2px;
    }
    
    .details-section {
      min-height: 6.68cm;
      display: flex;
      margin-top: 3em;
      margin-bottom: 4em;
    }
    
    .details-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .customer-info {
      width: 50%;
      font-size: 1.1em;
    }
    
    .customer-info h3 {
      color: #0066cc;
      margin-bottom: 0.5em;
      font-size: 14px;
    }
    
    .customer-info p {
      margin: 0.2em 0;
    }
    
    .invoice-info {
      width: 50%;
    }
    
    .info-table {
      line-height: 1.2;
      width: 100%;
    }
    
    .info-table td {
      padding: 1px 0;
      font-size: 11px;
    }
    
    .info-table td:first-child {
      width: 60%;
      padding-left: 2em;
    }
    
    .info-table td:last-child {
      padding-left: 2em;
      font-weight: bold;
    }
    
    .items-section {
      min-height: 8cm;
      max-height: 12cm;
    }
    
    .items-title {
      font-size: 16px;
      font-weight: bold;
      color: #0066cc;
      margin-bottom: 15px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 5px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
      border: 1px solid #ddd;
    }
    
    .items-table th,
    .items-table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
      font-size: 11px;
    }
    
    .items-table th {
      background-color: #f8f9fa;
      font-weight: bold;
      color: #0066cc;
      font-size: 12px;
    }
    
    .items-table td:nth-child(2),
    .items-table td:nth-child(3),
    .items-table td:nth-child(4),
    .items-table td:nth-child(5),
    .items-table td:nth-child(6),
    .items-table td:nth-child(7),
    .items-table td:nth-child(8) {
      text-align: right;
    }
    
    .item-description {
      line-height: 1.3;
    }
    
    .item-detail {
      color: #666;
      font-size: 10px;
    }
    
    .discount-info {
      color: #dc3545;
      font-size: 10px;
      line-height: 1.2;
    }
    
    .totals-section {
      margin-top: 2em;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .vat-summary {
      margin-bottom: 15px;
      width: 300px;
    }
    
    .vat-summary-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 11px;
      color: #666;
    }
    
    .vat-amount {
      font-weight: bold;
      color: #333;
    }
    
    .totals-table {
      width: 300px;
      border-top: 2px solid #0066cc;
      padding-top: 10px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      font-weight: bold;
    }
    
    .total-final {
      border-bottom: 2px solid #0066cc;
      border-top: 2px solid #0066cc;
      font-size: 1.2em;
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
      margin-top: 1cm;
      max-height: 8cm;
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
 * CSS styles for order PDF
 */
function getOrderStyles(): string {
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
    
    .order-container {
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
    
    .company-info {
      text-align: left;
    }
    
    .company-name {
      font-size: 24px;
      color: #0066cc;
      margin-bottom: 10px;
    }
    
    .company-address {
      font-size: 11px;
      color: #333;
      line-height: 1.2;
    }
    
    .document-info {
      text-align: right;
    }
    
    .document-type {
      font-size: 20px;
      color: #0066cc;
      margin-bottom: 5px;
    }
    
    .document-type-en {
      font-size: 12px;
      color: #666;
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
    
    .items-section {
      margin-bottom: 30px;
    }
    
    .items-section h3 {
      color: #0066cc;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
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
    .items-table td:nth-child(5),
    .items-table td:nth-child(6) {
      text-align: right;
    }
    
    .quotation-summary,
    .work-order-instructions,
    .qr-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #0066cc;
    }
    
    .quotation-summary h3,
    .work-order-instructions h3,
    .qr-section h3 {
      color: #0066cc;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .summary-table,
    .instructions-content,
    .qr-container {
      margin-top: 15px;
    }
    
    .summary-table tr,
    .instructions-content p,
    .qr-container p {
      margin-bottom: 5px;
    }
    
    .summary-table td,
    .instructions-content strong,
    .qr-container strong {
      font-weight: bold;
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
      .order-container {
        margin: 0;
        padding: 0;
      }
    }
  `;
}

/**
 * CSS styles for work order PDF
 */
function getWorkOrderStyles(): string {
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
    
    .work-order-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }
    
    .header-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
    }
    
    .header-content {
      display: flex;
      align-items: flex-end;
    }
    
    .company-info {
      text-align: left;
      margin-right: 20px;
    }
    
    .company-name {
      font-size: 24px;
      color: #0066cc;
      margin-bottom: 10px;
    }
    
    .company-address {
      font-size: 11px;
      color: #333;
      line-height: 1.2;
    }
    
    .document-type {
      text-align: left;
      font-weight: bold;
      font-size: large;
      padding-left: 14px;
    }
    
    .document-type h2 {
      font-size: 1.5em;
      margin: 0;
    }
    
    .document-type p {
      font-size: 0.8em;
      color: #666;
      margin: 0;
    }
    
    .details-section {
      min-height: 6.68cm;
      display: flex;
      margin-top: 3em;
      margin-bottom: 4em;
    }
    
    .details-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .customer-info {
      width: 50%;
      font-size: 1.1em;
    }
    
    .customer-info h3 {
      color: #0066cc;
      margin-bottom: 0.5em;
      font-size: 14px;
    }
    
    .customer-info p {
      margin: 0.2em 0;
    }
    
    .order-info {
      width: 50%;
    }
    
    .info-table {
      line-height: 1.5em;
      width: 100%;
    }
    
    .info-table td {
      padding: 0.2em 0;
    }
    
    .info-table td:first-child {
      width: 60%;
      padding-left: 2em;
    }
    
    .info-table td:last-child {
      padding-left: 2em;
      font-weight: bold;
    }
    
    .items-section {
      min-height: 13.70cm;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }
    
    .items-table th,
    .items-table td {
      border: 1px solid #ddd;
      padding: 0.5em 0;
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
    .items-table td:nth-child(5),
    .items-table td:nth-child(6) {
      text-align: right;
    }
    
    .quotation-summary,
    .work-order-instructions,
    .qr-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #0066cc;
    }
    
    .quotation-summary h3,
    .work-order-instructions h3,
    .qr-section h3 {
      color: #0066cc;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .summary-table,
    .instructions-content,
    .qr-container {
      margin-top: 15px;
    }
    
    .summary-table tr,
    .instructions-content p,
    .qr-container p {
      margin-bottom: 5px;
    }
    
    .summary-table td,
    .instructions-content strong,
    .qr-container strong {
      font-weight: bold;
    }
    
    .footer-section {
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .footer-content div {
      width: 50%;
      text-align: left;
    }
    
    .footer-content div strong {
      font-size: 1.1em;
      color: #0066cc;
    }
    
    .footer-content div p {
      margin-bottom: 2px;
    }
    
    .qr-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #0066cc;
    }
    
    .qr-section h3 {
      color: #0066cc;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .qr-container {
      margin-top: 15px;
    }
    
    .qr-code-visual {
      text-align: center;
    }
    
    .qr-code-visual img {
      max-width: 100px;
      max-height: 100px;
      margin: 0 auto 10px;
    }
    
    .qr-code-visual p {
      font-size: 0.7em;
      color: #666;
      margin-bottom: 5px;
    }
    
    .qr-code-placeholder {
      text-align: center;
      color: #666;
    }
    
    .qr-code-placeholder p {
      margin-bottom: 5px;
    }
    
    .qr-instructions {
      margin-top: 10px;
    }
    
    .qr-instructions h4 {
      color: #0066cc;
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    .qr-instructions ol {
      padding-left: 20px;
    }
    
    .qr-instructions li {
      margin-bottom: 3px;
    }
    
    @media print {
      .work-order-container {
        margin: 0;
        padding: 0;
      }
    }
  `;
}

/**
 * CSS styles for quotation PDF
 */
function getQuotationStyles(): string {
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
    
    .quotation-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }
    
    .header-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
    }
    
    .header-content {
      display: flex;
      align-items: flex-end;
    }
    
    .company-info {
      text-align: left;
      margin-right: 20px;
    }
    
    .company-name {
      font-size: 24px;
      color: #0066cc;
      margin-bottom: 10px;
    }
    
    .company-address {
      font-size: 11px;
      color: #333;
      line-height: 1.2;
    }
    
    .document-type {
      text-align: left;
      font-weight: bold;
      font-size: large;
      padding-left: 14px;
    }
    
    .document-type h2 {
      font-size: 1.5em;
      margin: 0;
    }
    
    .document-type p {
      font-size: 0.8em;
      color: #666;
      margin: 0;
    }
    
    .details-section {
      min-height: 6.68cm;
      display: flex;
      margin-top: 3em;
      margin-bottom: 4em;
    }
    
    .details-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .customer-info {
      width: 50%;
      font-size: 1.1em;
    }
    
    .customer-info h3 {
      color: #0066cc;
      margin-bottom: 0.5em;
      font-size: 14px;
    }
    
    .customer-info p {
      margin: 0.2em 0;
    }
    
    .order-info {
      width: 50%;
    }
    
    .info-table {
      line-height: 1.5em;
      width: 100%;
    }
    
    .info-table td {
      padding: 0.2em 0;
    }
    
    .info-table td:first-child {
      width: 60%;
      padding-left: 2em;
    }
    
    .info-table td:last-child {
      padding-left: 2em;
      font-weight: bold;
    }
    
    .items-section {
      min-height: 13.70cm;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }
    
    .items-table th,
    .items-table td {
      border: 1px solid #ddd;
      padding: 0.5em 0;
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
    .items-table td:nth-child(5),
    .items-table td:nth-child(6) {
      text-align: right;
    }
    
    .totals-section {
      margin-top: 2em;
      display: flex;
      justify-content: flex-end;
    }
    
    .totals-table {
      width: 300px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 0.3em 0;
      border-bottom: 1px solid #eee;
    }
    
    .total-final {
      border-bottom: 2px solid #0066cc;
      border-top: 2px solid #0066cc;
      font-size: 1.2em;
      padding: 10px 0;
    }
    
    .footer-section {
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .footer-content div {
      width: 50%;
      text-align: left;
    }
    
    .footer-content div strong {
      font-size: 1.1em;
      color: #0066cc;
    }
    
    .footer-content div p {
      margin-bottom: 2px;
    }
    
    @media print {
      .quotation-container {
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
 * Format currency for Finnish locale with thousand separators
 */
function formatCurrency(amount: any): string {
  const decimal = new Decimal(amount);
  const formatted = decimal.toFixed(2);
  // Add thousand separators (space) and use comma for decimal separator
  return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',') + ' €';
}

/**
 * Format decimal number for Finnish locale with thousand separators
 */
function formatDecimal(amount: any, precision: number = 2): string {
  const decimal = new Decimal(amount);
  const formatted = decimal.toFixed(precision);
  // Add thousand separators (space) and use comma for decimal separator
  return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
}

/**
 * Get text for order status
 */
function getOrderStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return 'Odottaa käsittelyä';
    case 'processing':
      return 'Käsittelyssä';
    case 'completed':
      return 'Valmis';
    case 'cancelled':
      return 'Peruttu';
    default:
      return status;
  }
}

/**
 * Get text for work order priority
 */
function getPriorityText(deliveryDate: Date | string | null): string {
  if (!deliveryDate) {
    return 'Ei määritelty';
  }
  const daysUntilDelivery = Math.ceil((new Date(deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilDelivery < 0) {
    return 'Eräpäivässä';
  } else if (daysUntilDelivery === 0) {
    return 'Tänään';
  } else if (daysUntilDelivery === 1) {
    return 'Huomenna';
  } else {
    return `${daysUntilDelivery} päivää`;
  }
} 