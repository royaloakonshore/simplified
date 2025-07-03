import type { Invoice, Order } from "@prisma/client";

export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  // TODO: Replace with real PDF generation (Puppeteer / React-pdf)
  const pdfPlaceholder = `<html><body><h1>Invoice ${invoice.invoiceNumber}</h1></body></html>`;
  return Buffer.from(pdfPlaceholder);
}

export async function generateOrderPdf(order: Order): Promise<Buffer> {
  const html = `<html><body><h1>Order ${order.orderNumber}</h1></body></html>`;
  return Buffer.from(html);
} 