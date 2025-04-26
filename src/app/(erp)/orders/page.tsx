import { Suspense } from 'react';
import Link from 'next/link';
import { listOrders } from '@/lib/actions/order.actions';
import OrderTable from '@/components/orders/OrderTable';
import OrderFilter from '@/components/orders/OrderFilter';
import { OrderStatus } from '@/lib/types/order.types';
import { MaterialType } from '@/lib/types/inventory.types';
import { Order as FormOrder, OrderItem as FormOrderItem } from '@/lib/types/order.types';
import { InventoryItem as FormInventoryItem } from '@/lib/types/inventory.types';
import { Address as FormAddress, AddressType } from '@/lib/types/customer.types';
import { UUID, Decimal, createUUID, createDecimal } from '@/lib/types/branded';

// type OrdersPageProps = {
//   searchParams: {
//     page?: string;
//     perPage?: string;
//     sortBy?: string;
//     sortDirection?: string;
//     status?: string;
//     searchTerm?: string;
//     fromDate?: string;
//     toDate?: string;
//     customerId?: string;
//   };
// };

// Interface OrdersData seems unused and can be removed if not needed elsewhere
// interface OrdersData {
//   items: any[];
//   meta: {
//     page: number;
//     perPage: number;
//     totalCount: number;
//     totalPages: number;
//   };
// }

export default async function OrdersPage(props: any) {
  const searchParams = props.searchParams ?? {};

  // Set up pagination and filters from URL params
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const sortBy = searchParams.sortBy || 'createdAt';
  const sortDirection = searchParams.sortDirection || 'desc';
  // Extract other potential filters explicitly if needed by listOrders
  const status = searchParams.status;
  const searchTerm = searchParams.searchTerm;
  // Add other filters like fromDate, toDate, customerId if required
  
  // Remove unused client-side handler stub
  // const handlePageChange = (newPage: number) => {
  //   // This is implemented client-side in the OrderTable component
  //   // using the router to update the URL params
  // };
  
  // Fetch orders data - pass explicit params
  const result = await listOrders({
    page,
    perPage,
    sortBy,
    sortDirection,
    status, // Pass explicitly
    searchTerm, // Pass explicitly
    // Pass other extracted filters here...
  });
  
  if (!result.success) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading orders: {result.error}
        </div>
      </div>
    );
  }
  
  // Set default values in case data is undefined
  const fetchedOrders = result.data?.items || [];
  const meta = result.data?.meta || {
    page: 1,
    perPage: 10,
    totalCount: 0,
    totalPages: 1
  };
  
  const mapPrismaOrderToFormOrder = (prismaOrder: (typeof fetchedOrders)[number]): FormOrder => {
    // Infer types for nested items
    type PrismaOrderItemType = (typeof prismaOrder.items)[number];
    type PrismaInventoryItemType = PrismaOrderItemType['item'];
    // type PrismaCustomerType = typeof prismaOrder.customer; // Not needed if addresses are absent
    // type PrismaAddressType = PrismaCustomerType['addresses'][number]; // Remove - addresses not in list data

    // Helper to map Prisma InventoryItem to FormInventoryItem
    const mapPrismaItemToFormItem = (prismaItem: PrismaInventoryItemType): FormInventoryItem => ({
      ...prismaItem,
      id: prismaItem.id,
      costPrice: prismaItem.costPrice.toNumber(),
      salesPrice: prismaItem.salesPrice.toNumber(),
      minimumStockLevel: prismaItem.minimumStockLevel.toNumber(),
      reorderLevel: prismaItem.reorderLevel.toNumber(),
      materialType: prismaItem.materialType as MaterialType,
    });
    
    // Remove Address mapping helper - not needed for list view
    // const mapPrismaAddressToFormAddress = (prismaAddress: PrismaAddressType): FormAddress => ({
    //     ...prismaAddress,
    //     id: prismaAddress.id,
    //     type: prismaAddress.type as AddressType,
    // });

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
        // Remove addresses mapping - not available in list data
        // addresses: prismaOrder.customer.addresses.map(mapPrismaAddressToFormAddress),
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
    };
  };

  const orders = fetchedOrders.map(mapPrismaOrderToFormOrder);
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Orders</h1>
        <Link
          href="/orders/add"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create New Order
        </Link>
      </div>
      
      <Suspense fallback={<div>Loading filters...</div>}>
        <OrderFilter />
      </Suspense>
      
      <Suspense fallback={<div>Loading orders...</div>}>
        <OrderTable
          orders={orders}
          totalCount={meta.totalCount}
          page={meta.page}
          perPage={meta.perPage}
          totalPages={meta.totalPages}
        />
      </Suspense>
    </div>
  );
} 