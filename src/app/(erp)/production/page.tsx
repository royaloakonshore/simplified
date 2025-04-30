'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { OrderStatus, type Order } from '@prisma/client';
import { api } from '@/lib/trpc/react';
import { KanbanColumn } from '@/components/production/KanbanColumn';
import { KanbanCard } from '@/components/production/KanbanCard';
import { toast } from 'react-toastify';

// Define the order of statuses for the columns
const productionStatuses: OrderStatus[] = [
  OrderStatus.confirmed,
  OrderStatus.in_production,
  OrderStatus.shipped,
  // Add other relevant statuses? e.g., delivered if it belongs here
];

// Helper to get status title
const getStatusTitle = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.confirmed: return 'Confirmed';
    case OrderStatus.in_production: return 'In Production';
    case OrderStatus.shipped: return 'Shipped';
    // Add cases for other statuses
    default: return status;
  }
};

type ProductionOrder = Order & { customer?: { name: string } };

export default function ProductionPage() {
  // Fetch all orders relevant to production (consider filtering if too many)
  const { data: orderData, isLoading, error } = api.order.list.useQuery({
    limit: 100, // Fetch a larger limit for the board view
    // Optionally filter by specific statuses if needed on initial load
    // status: { in: productionStatuses } // Prisma syntax example if needed
  });

  // State to hold the orders grouped by status
  const [ordersByStatus, setOrdersByStatus] = useState<Record<OrderStatus, ProductionOrder[]>>(() => {
    const initial: Partial<Record<OrderStatus, ProductionOrder[]>> = {};
    productionStatuses.forEach(status => { initial[status] = []; });
    return initial as Record<OrderStatus, ProductionOrder[]>;
  });

  // State for active drag item
  const [activeOrder, setActiveOrder] = useState<ProductionOrder | null>(null);

  // Memoize orders by status
  useMemo(() => {
    if (orderData?.items) {
      const grouped: Record<OrderStatus, ProductionOrder[]> = { ...ordersByStatus }; // Start with current state or empty
       // Ensure all defined columns exist
       productionStatuses.forEach(status => { if (!grouped[status]) grouped[status] = []; });

      orderData.items.forEach((order) => {
        // Only include orders matching our defined production statuses
        if (productionStatuses.includes(order.status)) {
           if (!grouped[order.status]) {
             grouped[order.status] = [];
           }
          // Avoid adding duplicates if already present (e.g., from local state updates)
           if (!grouped[order.status].some(o => o.id === order.id)) {
                grouped[order.status].push(order as ProductionOrder);
           }
        }
      });

      // Preserve order within columns if possible, or sort
       Object.keys(grouped).forEach((statusKey) => {
           grouped[statusKey as OrderStatus].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
       });

      setOrdersByStatus(grouped);
    }
  }, [orderData]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Mutation hook for updating status
   const updateStatusMutation = api.order.updateStatus.useMutation({
       onSuccess: (updatedOrder) => {
          toast.success(`Order #${updatedOrder.orderNumber} moved to ${getStatusTitle(updatedOrder.status)}`);
          // Note: We rely on the query refetch or manual state update for UI change
          // Could potentially update local state here for instant feedback, but complex
       },
       onError: (error) => {
          toast.error(`Failed to move order: ${error.message}`);
          // TODO: Revert local state change if implemented
       },
       // Optional: Invalidate query on settlement to refetch
       // onSettled: () => { utils.order.list.invalidate(); }
   });

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Order') {
      setActiveOrder(event.active.data.current.order);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveAnOrder = active.data.current?.type === 'Order';
    const isOverAnOrder = over.data.current?.type === 'Order';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveAnOrder) return;

    // Find current column and item details
    const activeOrderData = active.data.current?.order as ProductionOrder;
    let currentColumnId: OrderStatus | undefined;
    let currentItemIndex = -1;

    Object.entries(ordersByStatus).forEach(([status, orders]) => {
        const index = orders.findIndex(o => o.id === activeId);
        if (index !== -1) {
            currentColumnId = status as OrderStatus;
            currentItemIndex = index;
        }
    });

    if (!currentColumnId) return;

    if (isOverAColumn) {
        const targetColumnId = over.data.current?.status as OrderStatus;

        if (currentColumnId !== targetColumnId) {
           setOrdersByStatus((prev) => {
               const activeItems = prev[currentColumnId!];
               const overItems = prev[targetColumnId];

               // Remove from active column
               const updatedActiveItems = activeItems.filter(o => o.id !== activeId);
               // Add to target column (typically at the end)
               const updatedOverItems = [...overItems, activeOrderData];

               // Sort target column if necessary (e.g., by date)
               updatedOverItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

               return { ...prev, [currentColumnId!]: updatedActiveItems, [targetColumnId]: updatedOverItems };
           });
        }
    }

    if (isOverAnOrder) {
        let targetColumnId: OrderStatus | undefined;
        let targetItemIndex = -1;

        Object.entries(ordersByStatus).forEach(([status, orders]) => {
            const index = orders.findIndex(o => o.id === overId);
            if (index !== -1) {
                targetColumnId = status as OrderStatus;
                targetItemIndex = index;
            }
        });

        if (!targetColumnId) return;

        if (currentColumnId === targetColumnId) {
            // Reordering within the same column
            setOrdersByStatus((prev) => {
                const items = prev[currentColumnId!];
                const newIndex = items.findIndex(o => o.id === overId);
                return { ...prev, [currentColumnId!]: arrayMove(items, currentItemIndex, newIndex) };
            });
        } else {
            // Moving to a different column over an item
             setOrdersByStatus((prev) => {
                const activeItems = prev[currentColumnId!];
                const overItems = prev[targetColumnId!];
                const overIndex = overItems.findIndex(o => o.id === overId);

                const updatedActiveItems = activeItems.filter(o => o.id !== activeId);
                const updatedOverItems = [
                    ...overItems.slice(0, overIndex),
                    activeOrderData,
                    ...overItems.slice(overIndex)
                ];
                updatedOverItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                return { ...prev, [currentColumnId!]: updatedActiveItems, [targetColumnId!]: updatedOverItems };
             });
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeOrderData = active.data.current?.order as ProductionOrder;
    const targetColumnId = over.data.current?.status as OrderStatus | undefined;

    if (!activeOrderData || !targetColumnId) {
        console.warn('Drag end without active order data or target column status');
        return;
    }

    // Find original status
    let originalStatus: OrderStatus | undefined;
     Object.entries(ordersByStatus).forEach(([status, orders]) => {
         if (orders.some(o => o.id === activeId)) {
             originalStatus = status as OrderStatus;
         }
     });

    if (targetColumnId && originalStatus !== targetColumnId) {
      console.log(`Moving order ${activeId} from ${originalStatus} to ${targetColumnId}`);
      // Call the mutation to update the status in the backend
      updateStatusMutation.mutate({ id: activeId, status: targetColumnId });
    } else {
        console.log('Order dropped in the same column or invalid target.');
         // If only reordering occurred within the same column, no mutation needed,
         // but state was already updated optimistically in handleDragOver
    }
  };

  if (isLoading) return <div>Loading production orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;

  return (
    <div className="flex flex-col h-full p-4">
        <h1 className="text-2xl font-bold mb-4">Production Pipeline</h1>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 flex-1 overflow-x-auto">
                {productionStatuses.map((status) => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        title={getStatusTitle(status)}
                        orders={ordersByStatus[status] ?? []}
                    />
                ))}
            </div>

            <DragOverlay>
                {activeOrder ? <KanbanCard order={activeOrder} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    </div>
  );
} 