import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateInvoicePdf } from '@/lib/services/pdf.service';
import { prisma } from '@/lib/db';
import { TRPCError } from '@trpc/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  try {
    // Get session and verify authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // invoiceId is already extracted above
    const companyId = (session.user as any).companyId;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 400 }
      );
    }

    // Fetch invoice with all required relations
    const invoice = await prisma.invoice.findUnique({
      where: { 
        id: invoiceId,
        companyId: companyId // Ensure company scoping
      },
      include: {
        customer: { include: { addresses: true } },
        Company: true,
        items: {
          include: {
            inventoryItem: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoice as any);

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('PDF generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
