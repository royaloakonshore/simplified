'use client'; // Need client component for hooks

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation'; // Use hooks
import { api } from "@/lib/trpc/react"; // Import tRPC hooks
import OrderForm from '@/components/orders/OrderForm';
import { OrderStatus } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Removed unused imports: notFound, prisma, getOrderById, MaterialType, FormOrder, FormOrderItem, FormInventoryItem, FormAddress, AddressType, UUID, Decimal, createUUID, createDecimal

// Fetch data required for the form (customers, inventory, specific order)
async function getEditFormData(orderId: string) {

  // Fetch the specific order including items and related item details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
        items: {
            include: {
                item: true, // Include InventoryItem details for each OrderItem
            },
        },
    },
  });

  if (!order) {
    notFound(); // Trigger 404 if order doesn't exist
  }

  // Fetch customers (only need id and name for select)
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch inventory items (id, name, price, unit for select and auto-price)
  const inventoryItems = await prisma.inventoryItem.findMany({
    select: {
        id: true,
        name: true,
        salesPrice: true,
        unitOfMeasure: true
    },
    orderBy: { name: 'asc' },
  });

  // Remove the conversion logic - pass Prisma types directly
  /*
   const orderForForm = {
    ...order,
    items: order.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(), // Convert for form
        unitPrice: item.unitPrice.toNumber(), // Convert for form
    }))
  };
  */

  // Type definition remains useful for clarity if needed elsewhere,
  // but not strictly required for the return value here.
  /*
  type OrderForFormType = Prisma.OrderGetPayload<{
      include: {
          items: { include: { item: true } }
      }
  }>;
  */

  return {
      order: order, // Return the raw order object with Decimal types
      customers,
      inventoryItems
    };
}

// Reuse Skeleton from add page or create specific one
function OrderFormSkeleton() {
    // ... (Same skeleton as in add/page.tsx)
     return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-8 w-1/4" />
            <div className="border rounded-md p-4">
                <Skeleton className="h-6 w-1/5 mb-2" />
                <Skeleton className="h-10 w-full mb-4" />
                <Skeleton className="h-6 w-1/5 mb-2" />
                <Skeleton className="h-20 w-full mb-4" />
                <Skeleton className="h-6 w-1/5 mb-2" />
                 <div className="flex space-x-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-16" />
                 </div>
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-10 w-28" />
            </div>
        </div>
    );
}

// Define props inline using standard Next.js convention
export default async function EditOrderPage({ params }: {
    params: { id: string };
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const orderId = params.id;
  if (!orderId) {
      notFound(); // Should have ID from dynamic route
  }

  // Fetch data in the Server Component
  const formDataPromise = getEditFormData(orderId);

  return (
    <div className="container mx-auto py-8">
      {/* Add breadcrumbs or back button here? */}
       <Suspense fallback={<OrderFormSkeleton />}>
          <EditOrderFormWrapper formDataPromise={formDataPromise} />
       </Suspense>
    </div>
  );
}

// Wrapper component to handle awaited promise inside Suspense
async function EditOrderFormWrapper({ formDataPromise }: { formDataPromise: ReturnType<typeof getEditFormData> }) {
    const { order, customers, inventoryItems } = await formDataPromise;

    return (
        <OrderForm
            order={order} // Pass the specific order
            customers={customers}
            inventoryItems={inventoryItems}
            isEditMode={true} // Set form to edit mode
        />
    );
} 