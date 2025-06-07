'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { type Order } from '@prisma/client'; // Assuming Order type includes necessary fields
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface KanbanCardProps {
  order: Order & { customer?: { name: string } }; // Include customer name if needed
  isOverlay?: boolean;
}

export function KanbanCard({ order, isOverlay }: KanbanCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
    data: {
      type: 'Order',
      order,
    },
    // attributes: { // Consider ARIA attributes
    //   roleDescription: 'sortable order card',
    // },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes} // Only pass drag attributes to the card itself
      data-dragging={isDragging}
      data-overlay={isOverlay}
      className={`mb-2 touch-none ${isDragging ? 'opacity-50 scale-105 shadow-md' : ''} ${isOverlay ? 'shadow-lg' : ''}`}
    >
      <CardHeader className="p-2 flex flex-row items-center justify-between border-b">
        <CardTitle className="text-sm font-medium truncate">
           Order #{order.orderNumber}
        </CardTitle>
        {/* Drag handle listener */}
        <Button variant="ghost" {...listeners} className="h-6 w-6 p-1 cursor-grab">
            <span className="sr-only">Move order</span>
            <GripVertical className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-2 text-xs space-y-1">
        <p>Customer: {order.customer?.name ?? 'N/A'}</p>
        <p>Total: {formatCurrency((order.totalAmount ?? 0).toString())}</p>
        {/* Add more relevant details */}
      </CardContent>
    </Card>
  );
} 