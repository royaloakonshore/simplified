import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/actions/order.actions';
import OrderDetail from '@/components/orders/OrderDetail';
import { OrderStatus } from '@/lib/types/order.types';
import { MaterialType } from '@/lib/types/inventory.types';
import { Order as FormOrder, OrderItem as FormOrderItem, OrderWithStockStatus } from '@/lib/types/order.types';
import { InventoryItem as FormInventoryItem } from '@/lib/types/inventory.types';
import { Address as FormAddress, AddressType } from '@/lib/types/customer.types';
import { UUID, Decimal, createUUID, createDecimal } from '@/lib/types/branded';

// type OrderPageProps = {
//   params: {
//     id: string;
//   };
// };

export default async function OrderPage(props: any) {
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
  
  // Add explicit check for undefined order
  if (!fetchedOrder) {
    console.error("Error: Order data is undefined despite successful fetch for ID:", id);
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          An unexpected error occurred while loading the order details.
        </div>
      </div>
    );
    // notFound(); // Or use notFound() if appropriate
  }
  
  // --- Copy mapping logic from edit page --- 
  const mapPrismaOrderToOrderDetail = (prismaOrder: typeof fetchedOrder): OrderWithStockStatus => {
    type PrismaOrderItemType = (typeof fetchedOrder.items)[number];
    type PrismaInventoryItemType = PrismaOrderItemType['item'];
    type PrismaCustomerType = typeof fetchedOrder.customer;
    type PrismaAddressType = PrismaCustomerType['addresses'][number];

    const mapPrismaItemToFormItem = (prismaItem: PrismaInventoryItemType): FormInventoryItem => ({
      ...prismaItem,
      id: prismaItem.id,
      costPrice: prismaItem.costPrice.toNumber(),
      salesPrice: prismaItem.salesPrice.toNumber(),
      minimumStockLevel: prismaItem.minimumStockLevel.toNumber(),
      reorderLevel: prismaItem.reorderLevel.toNumber(),
      materialType: prismaItem.materialType as MaterialType,
    });
    
    const mapPrismaAddressToFormAddress = (prismaAddress: PrismaAddressType): FormAddress => ({
        ...prismaAddress,
        id: prismaAddress.id,
        type: prismaAddress.type as AddressType,
    });

    // Map to OrderWithStockStatus
    return {
      ...prismaOrder,
      id: createUUID(prismaOrder.id),
      customerId: createUUID(prismaOrder.customerId),
      totalAmount: createDecimal(prismaOrder.totalAmount.toNumber()),
      notes: prismaOrder.notes ?? undefined,
      status: prismaOrder.status as OrderStatus,
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
        quantity: createDecimal(prismaOrderItem.quantity.toNumber()), 
        unitPrice: createDecimal(prismaOrderItem.unitPrice.toNumber()),
        item: mapPrismaItemToFormItem(prismaOrderItem.item),
      })),
      // Explicitly include stock status properties, casting types as needed
      hasInsufficientStock: (prismaOrder as any).hasInsufficientStock ?? false,
      outOfStockItems: (prismaOrder as any).outOfStockItems?.map((item: any) => ({
        ...item,
        itemId: createUUID(item.itemId),
        quantityRequested: createDecimal(item.quantityRequested.toNumber()),
        quantityAvailable: createDecimal(item.quantityAvailable.toNumber()),
      })) ?? undefined,
    };
  };

  const order = mapPrismaOrderToOrderDetail(fetchedOrder); // Use the mapping function
  
  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link
          href="/orders"
          className="mr-4 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Orders
        </Link>
      </div>
      
      <OrderDetail order={order} /> // Pass mapped order
    </div>
  );
} 