import Link from 'next/link';
import { prisma } from '@/lib/db';
import OrderForm from '@/components/orders/OrderForm';
import { MaterialType } from '@/lib/types/inventory.types'; // Import local MaterialType enum

export default async function AddOrderPage() {
  // Fetch customers and inventory items for the form
  // @ts-ignore - Prisma client types issue
  const customers = await prisma.customer.findMany({
    orderBy: {
      name: 'asc',
    },
  });
  
  // @ts-ignore - Prisma client types issue
  const prismaInventoryItems = await prisma.inventoryItem.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  // Map Prisma types to form types for inventory items
  type PrismaItemType = (typeof prismaInventoryItems)[number];
  const inventoryItems = prismaInventoryItems.map((item: PrismaItemType) => ({
    ...item,
    costPrice: item.costPrice.toNumber(),
    salesPrice: item.salesPrice.toNumber(),
    minimumStockLevel: item.minimumStockLevel.toNumber(),
    reorderLevel: item.reorderLevel.toNumber(),
    materialType: item.materialType as MaterialType,
  }));
  
  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link
          href="/orders"
          className="mr-4 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Orders
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Create New Order
        </h1>
      </div>
      
      <OrderForm customers={customers} inventoryItems={inventoryItems} />
    </div>
  );
} 