import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { generateInvoicePdf, generateOrderPdf } from "@/lib/services/pdf.service";
import { InvoiceEmail } from "@/lib/email/templates/InvoiceEmail";
import { OrderEmail } from "@/lib/email/templates/OrderEmail";
import { createElement } from "react";
import { getLanguageWithFallback } from "@/lib/utils/localization";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendInvoiceEmail(options: {
  invoiceId: string;
  method: "email-pdf" | "download-pdf" | "download-xml";
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: options.invoiceId },
    include: {
      customer: true,
      items: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  const customer = invoice.customer;
  const language = getLanguageWithFallback((customer as any).language);

  // PDF/XML placeholder generation
  const pdfBuffer = await generateInvoicePdf(invoice);
  // TODO: XML generation

  const subjectMap = {
    FI: `Lasku ${invoice.invoiceNumber}`,
    SE: `Faktura ${invoice.invoiceNumber}`,
    EN: `Invoice ${invoice.invoiceNumber}`,
  } as const;

  if (options.method === "email-pdf") {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@erp.local",
      to: customer.email || "test@example.com",
      subject: subjectMap[language],
      react: createElement(InvoiceEmail, { invoice, customer, language }),
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
  }
  // download-pdf / download-xml handled client-side – service just returns buffers
  return { pdfBuffer /*, xmlBuffer*/ };
}

export async function sendOrderEmail(options: {
  orderId: string;
  method: "email-pdf" | "download-pdf";
}) {
  const order = await prisma.order.findUnique({
    where: { id: options.orderId },
    include: {
      customer: true,
      items: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!order) throw new Error("Order not found");
  const customer = order.customer;
  const language = getLanguageWithFallback((customer as any).language);

  const pdfBuffer = await generateOrderPdf(order);

  // Ensure we only send emails for quotations
  if ((order as any).orderType !== "QUOTATION") {
    throw new Error("sendOrderEmail supports only quotations. Attempted to send for non-quotation order.");
  }

  const subjectMap = {
    FI: `Tarjous ${order.orderNumber}`,
    SE: `Offert ${order.orderNumber}`,
    EN: `Quotation ${order.orderNumber}`,
  } as const;

  if (options.method === "email-pdf") {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "no-reply@erp.local",
      to: customer.email || "test@example.com",
      subject: subjectMap[language],
      react: createElement(OrderEmail, { order, customer, language }),
      attachments: [
        {
          filename: `${order.orderNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
  }

  return { pdfBuffer };
} 