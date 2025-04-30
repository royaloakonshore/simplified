'use client';

import React from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { type Order, OrderStatus } from '@prisma/client';
import { KanbanCard } from './KanbanCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  status: OrderStatus;
  orders: (Order & { customer?: { name: string } })[];
  title: string;
}

export function KanbanColumn({ status, orders, title }: KanbanColumnProps) {
  const orderIds = React.useMemo(() => orders.map((o) => o.id), [orders]);

  const { setNodeRef } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status: status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-72 shrink-0 border rounded-md bg-muted/40 h-full"
    >
      <h3 className="p-3 font-semibold border-b text-center sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
        {title} ({orders.length})
      </h3>

      <ScrollArea className="flex-1 p-2">
          <SortableContext items={orderIds}>
            {orders.length > 0 ? (
                orders.map((order) => (
                    <KanbanCard key={order.id} order={order} />
                ))
            ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                    No orders in this stage.
                </div>
            )}
          </SortableContext>
      </ScrollArea>
    </div>
  );
} 