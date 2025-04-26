import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
// import { Prisma } from '@prisma/client'; // Remove Prisma namespace import
import { getOrderById } from '@/lib/actions/order.actions';
import OrderForm from '@/components/orders/OrderForm';
import { OrderStatus } from '@/lib/types/order.types';
import { MaterialType } from '@/lib/types/inventory.types'; // Import local MaterialType enum
import { Order as FormOrder, OrderItem as FormOrderItem } from '@/lib/types/order.types'; // Import local Order types
import { InventoryItem as FormInventoryItem } from '@/lib/types/inventory.types'; // Import local InventoryItem type
import { Address as FormAddress, AddressType } from '@/lib/types/customer.types'; // Import local Address types
import { UUID, Decimal, createUUID, createDecimal } from '@/lib/types/branded'; // Import branded types/helpers - Assuming createDecimal exists

// @ts-ignore - Adding this to bypass the type error with Next.js params
export default async function EditOrderPage(props: any) {
  const { id } = props.params;
  
  // Fetch order data
  const result = await getOrderById(id);
  
  if (!result.success) {
    // If order not found, show 404 page
    if (result.error === 'Order not found') {
      notFound();
    }
    
    // Handle other errors
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading order: {result.error}
        </div>
      </div>
    );
  }
  
  const fetchedOrder = result.data;
  
  // Explicitly check if order is defined after success check
  if (!fetchedOrder) {
    // This case might indicate an unexpected issue with getOrderById returning success=true but data=null/undefined
    console.error("Error: Order data is undefined despite successful fetch for ID:", id);
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          An unexpected error occurred while loading the order.
        </div>
      </div>
    );
    // Alternatively, call notFound() if this state is considered impossible or unrecoverable
    // notFound(); 
  }
  
  // Map Prisma types from fetchedOrder to the types expected by OrderForm
  const mapPrismaOrderToFormOrder = (prismaOrder: typeof fetchedOrder): FormOrder => {
    // Infer types
    type PrismaOrderItemType = (typeof fetchedOrder.items)[number];
    type PrismaInventoryItemType = PrismaOrderItemType['item'];
    type PrismaCustomerType = typeof fetchedOrder.customer;
    type PrismaAddressType = PrismaCustomerType['addresses'][number];

    // Helper to map Prisma InventoryItem to FormInventoryItem
    const mapPrismaItemToFormItem = (prismaItem: PrismaInventoryItemType): FormInventoryItem => ({
      ...prismaItem,
      // Assuming FormInventoryItem expects string ID based on previous errors/context
      id: prismaItem.id, 
      costPrice: prismaItem.costPrice.toNumber(),
      salesPrice: prismaItem.salesPrice.toNumber(),
      minimumStockLevel: prismaItem.minimumStockLevel.toNumber(),
      reorderLevel: prismaItem.reorderLevel.toNumber(),
      materialType: prismaItem.materialType as MaterialType,
    });
    
    // Helper to map Prisma Address to FormAddress
    const mapPrismaAddressToFormAddress = (prismaAddress: PrismaAddressType): FormAddress => ({
        ...prismaAddress,
        // Assuming FormAddress expects string ID
        id: prismaAddress.id, 
        // Cast AddressType enum
        type: prismaAddress.type as AddressType,
        // Assuming other fields match
    });

    return {
      ...prismaOrder,
      id: createUUID(prismaOrder.id),
      customerId: createUUID(prismaOrder.customerId),
      // Convert Prisma Decimal to local Decimal (assuming it's number-based)
      totalAmount: createDecimal(prismaOrder.totalAmount.toNumber()), 
      notes: prismaOrder.notes ?? undefined,
      status: prismaOrder.status as OrderStatus,
      // Map customer object, including addresses
      customer: { 
        ...prismaOrder.customer,
        id: createUUID(prismaOrder.customer.id),
        addresses: prismaOrder.customer.addresses.map(mapPrismaAddressToFormAddress),
      },
      items: prismaOrder.items.map((prismaOrderItem: PrismaOrderItemType): FormOrderItem => ({
        ...prismaOrderItem,
        id: createUUID(prismaOrderItem.id),
        orderId: createUUID(prismaOrderItem.orderId),
        itemId: createUUID(prismaOrderItem.itemId),
        // Convert Prisma Decimal to local Decimal
        quantity: createDecimal(prismaOrderItem.quantity.toNumber()), 
        unitPrice: createDecimal(prismaOrderItem.unitPrice.toNumber()),
        item: mapPrismaItemToFormItem(prismaOrderItem.item),
      })),
      // Include stock status properties if they exist and are needed by FormOrder
      // hasInsufficientStock: (prismaOrder as any).hasInsufficientStock,
      // outOfStockItems: (prismaOrder as any).outOfStockItems?.map(item => ({...}))
    };
  };

  const order = mapPrismaOrderToFormOrder(fetchedOrder);
  
  // Only draft orders can be edited
  if (order.status !== OrderStatus.DRAFT) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Link
            href={`/orders/${id}`}
            className="mr-4 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Order
          </Link>
        </div>
        
        <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
          <h2 className="text-lg font-medium mb-2">Cannot Edit Order</h2>
          <p>
            Only orders in "Draft" status can be edited. This order is in "{order.status}" status.
          </p>
          <div className="mt-4">
            <Link
              href={`/orders/${id}`}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Return to Order
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
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

  // Map Prisma Decimal types and enums to local types for the form component
  type PrismaItemType = (typeof prismaInventoryItems)[number];

  const inventoryItems = prismaInventoryItems.map((item: PrismaItemType) => ({
    ...item,
    costPrice: item.costPrice.toNumber(),
    salesPrice: item.salesPrice.toNumber(),
    minimumStockLevel: item.minimumStockLevel.toNumber(),
    reorderLevel: item.reorderLevel.toNumber(),
    // Explicitly map the enum value
    materialType: item.materialType as MaterialType, // Assuming values match directly
  }));
  
  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link
          href={`/orders/${id}`}
          className="mr-4 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Order
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Edit Order {order.orderNumber}
        </h1>
      </div>
      
      <OrderForm 
        customers={customers} 
        inventoryItems={inventoryItems} 
        order={order}
        isEditMode={true}
      />
    </div>
  );
} 