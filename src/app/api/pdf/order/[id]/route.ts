import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateOrderPdf } from '@/lib/services/pdf.service';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  try {
    // Get session and verify authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const companyId = (session.user as any).companyId;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 400 }
      );
    }

    // Fetch order with all required relations
    const order = await prisma.order.findUnique({
      where: { 
        id: orderId,
        companyId: companyId // Ensure company scoping
      },
      include: {
        customer: {
          include: {
            addresses: true,
          },
        },
        items: {
          include: {
            inventoryItem: true,
          },
        },
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateOrderPdf(order as any);

    // Return PDF as response
    const filename = `${order.orderType === 'quotation' ? 'tarjous' : 'tyojarjestys'}_${order.orderNumber}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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