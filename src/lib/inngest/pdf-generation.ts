import { inngest } from "../../../inngest.config";
import { generateInvoicePdf, generateOrderPdf } from "../services/pdf.service";
import { prisma } from "../db";
import { TRPCError } from "@trpc/server";

/**
 * Background job for generating invoice PDFs
 */
export const generateInvoicePdfJob = inngest.createFunction(
  { 
    id: "generate-invoice-pdf",
    name: "Generate Invoice PDF" 
  },
  { event: "pdf/generate-invoice" },
  async ({ event, step }) => {
    const { invoiceId, companyId } = event.data;

    // Step 1: Fetch invoice with all required relations
    const invoice = await step.run("fetch-invoice", async () => {
      const invoiceData = await prisma.invoice.findUnique({
        where: { 
          id: invoiceId,
          companyId: companyId // Ensure company scoping
        },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: true
            }
          }
        }
      });

      if (!invoiceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found"
        });
      }

      return invoiceData;
    });

    // Step 2: Generate PDF
    const pdfBuffer = await step.run("generate-pdf", async () => {
      try {
        return await generateInvoicePdf(invoice as any);
      } catch (error) {
        console.error("PDF generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate PDF"
        });
      }
    });

    // Step 3: Store PDF (could be saved to S3, database, or file system)
    const pdfUrl = await step.run("store-pdf", async () => {
      // For now, we'll return the PDF as base64 for immediate download
      // In production, you might want to store this in S3 or similar
      // Handle serialized Buffer from Inngest
      const base64Pdf = Buffer.isBuffer(pdfBuffer) 
        ? pdfBuffer.toString('base64')
        : Buffer.from(pdfBuffer.data || pdfBuffer).toString('base64');
      
      // You could also save to database or S3 here
      // await savePdfToStorage(invoiceId, pdfBuffer);
      
      return `data:application/pdf;base64,${base64Pdf}`;
    });

    // Step 4: Update invoice with PDF generation status
    await step.run("update-invoice-status", async () => {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          // You could add a pdfGeneratedAt field to track this
          updatedAt: new Date()
        }
      });
    });

    return {
      success: true,
      invoiceId,
      pdfUrl,
      message: "PDF generated successfully"
    };
  }
);

/**
 * Background job for generating order PDFs
 */
export const generateOrderPdfJob = inngest.createFunction(
  { 
    id: "generate-order-pdf",
    name: "Generate Order PDF" 
  },
  { event: "pdf/generate-order" },
  async ({ event, step }) => {
    const { orderId, companyId } = event.data;

    // Step 1: Fetch order with all required relations
    const order = await step.run("fetch-order", async () => {
      const orderData = await prisma.order.findUnique({
        where: { 
          id: orderId,
          companyId: companyId // Ensure company scoping
        },
        include: {
          customer: true,
          items: {
            include: {
              inventoryItem: true
            }
          }
        }
      });

      if (!orderData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found"
        });
      }

      return orderData;
    });

    // Step 2: Generate PDF
    const pdfBuffer = await step.run("generate-pdf", async () => {
      try {
        return await generateOrderPdf(order as any);
      } catch (error) {
        console.error("PDF generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate PDF"
        });
      }
    });

    // Step 3: Store PDF
    const pdfUrl = await step.run("store-pdf", async () => {
      // Handle serialized Buffer from Inngest
      const base64Pdf = Buffer.isBuffer(pdfBuffer) 
        ? pdfBuffer.toString('base64')
        : Buffer.from(pdfBuffer.data || pdfBuffer).toString('base64');
      return `data:application/pdf;base64,${base64Pdf}`;
    });

    // Step 4: Update order with PDF generation status
    await step.run("update-order-status", async () => {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          updatedAt: new Date()
        }
      });
    });

    return {
      success: true,
      orderId,
      pdfUrl,
      message: "PDF generated successfully"
    };
  }
);

/**
 * Helper function to trigger PDF generation for invoice
 */
export async function triggerInvoicePdfGeneration(invoiceId: string, companyId: string) {
  return await inngest.send({
    name: "pdf/generate-invoice",
    data: {
      invoiceId,
      companyId
    }
  });
}

/**
 * Helper function to trigger PDF generation for order
 */
export async function triggerOrderPdfGeneration(orderId: string, companyId: string) {
  return await inngest.send({
    name: "pdf/generate-order",
    data: {
      orderId,
      companyId
    }
  });
}
