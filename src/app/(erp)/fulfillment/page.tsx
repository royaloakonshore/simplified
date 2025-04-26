import Link from 'next/link';
import { prisma as prismaClient } from '@/lib/db';
import { PrismaClient } from '@prisma/client';
import { OrderStatus as LocalOrderStatus, Order } from '@/lib/types/order.types'; // Use local enum
import FulfillmentBoard from '@/components/fulfillment/FulfillmentBoard';

// Explicitly type the client instance
const prisma: PrismaClient = prismaClient;

// Remove explicit type definition - rely on inference + casting
// type OrderWithRelations = Prisma.OrderGetPayload<{ ... }>

export default async function FulfillmentPage() {
  // Use local OrderStatus enum and cast for Prisma query
  const processingStatusesLocal: LocalOrderStatus[] = [
    LocalOrderStatus.CONFIRMED,
    LocalOrderStatus.IN_PRODUCTION, 
  ];
  
  // Let TS infer the type here
  const ordersFromDb = await prisma.order.findMany({
    where: {
      status: {
        in: processingStatusesLocal as any[], // Cast to any[] for Prisma query
      },
    },
    include: {
      customer: true,
      items: {
        include: {
          item: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  // Explicitly type 'order' in filters
  const productionOrders = ordersFromDb.filter(
    (order: typeof ordersFromDb[0]) => order.status === LocalOrderStatus.IN_PRODUCTION
  );
  const confirmedOrders = ordersFromDb.filter(
    (order: typeof ordersFromDb[0]) => order.status === LocalOrderStatus.CONFIRMED
  );

  // Cast to 'any' for props - requires FulfillmentBoard prop update or data mapping
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Order Fulfillment
        </h1>
        <Link
          href="/orders"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          View All Orders
        </Link>
      </div>
      
      <div className="mb-4">
        <p className="text-neutral-600 dark:text-neutral-400">
          Manage orders that need to be fulfilled. Drag orders between columns to update their status.
        </p>
      </div>
      
      <FulfillmentBoard 
        confirmedOrders={confirmedOrders as any} 
        productionOrders={productionOrders as any}
      />
    </div>
  );
} 