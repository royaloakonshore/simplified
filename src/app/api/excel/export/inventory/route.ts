import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma as db } from '@/lib/db';
import { exportInventoryToExcel } from '@/lib/services/excel.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's active company
    const user = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user?.activeCompanyId) {
      return NextResponse.json({ error: 'No active company' }, { status: 400 });
    }

    // Fetch inventory items for the company
    const inventoryItems = await db.inventoryItem.findMany({
      where: { companyId: user.activeCompanyId },
      include: { inventoryCategory: true },
      orderBy: { name: 'asc' }
    });

    // Generate Excel file
    const excelBuffer = exportInventoryToExcel(inventoryItems);

    // Set headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename="tuotteet_${new Date().toISOString().split('T')[0]}.xlsx"`);

    return new NextResponse(excelBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error exporting inventory:', error);
    return NextResponse.json(
      { error: 'Failed to export inventory' },
      { status: 500 }
    );
  }
} 