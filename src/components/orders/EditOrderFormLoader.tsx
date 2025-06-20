import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client'; // Keep for potential future type use
import OrderForm from '@/components/orders/OrderForm';
import { Skeleton } from "@/components/ui/skeleton";

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

    return {
        order: order, // Return the raw order object with Decimal types
        customers,
        inventoryItems
    };
}

// Skeleton component
export function OrderFormSkeleton() {
    // ... (Same skeleton as in add/page.tsx) - Export if needed elsewhere, keep local if not
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


// Wrapper component to handle async operations - renamed to EditOrderFormLoader
export default async function EditOrderFormLoader({ orderId }: { orderId: string }) {
    // Perform session check inside the async wrapper
    const session = await getServerAuthSession();
    if (!session?.user) {
        // Redirect or handle unauthorized access appropriately
        redirect('/api/auth/signin?callbackUrl=/orders/' + orderId + '/edit');
    }

    // Fetch data inside the wrapper
    const { order, customers, inventoryItems } = await getEditFormData(orderId);

    return (
        <OrderForm
            order={order} // Pass the specific order
            customers={customers}
            inventoryItems={inventoryItems}
            isEditMode={true} // Set form to edit mode
        />
    );
} 