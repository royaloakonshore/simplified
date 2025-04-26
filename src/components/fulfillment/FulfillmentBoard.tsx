"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Order, OrderStatus } from '@/lib/types/order.types';
import { updateOrderStatus } from '@/lib/actions/order.actions';

type FulfillmentBoardProps = {
  confirmedOrders: Order[];
  productionOrders: Order[];
};

export default function FulfillmentBoard({
  confirmedOrders,
  productionOrders,
}: FulfillmentBoardProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Handle order status update
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const result = await updateOrderStatus(orderId, { status: newStatus });
      
      if (!result.success) {
        // Handle different error shapes that can come from the server action
        const errorMessage = 'error' in result 
          ? result.error 
          : 'data' in result && result.data && typeof result.data === 'object' && 'hasInsufficientStock' in result.data 
            ? 'Insufficient stock for one or more items' 
            : 'An unknown error occurred';
        
        throw new Error(errorMessage);
      }
      
      // Refresh page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error updating order status:', err);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Function to render a single order card
  const renderOrderCard = (order: Order, nextStatus?: OrderStatus) => (
    <div 
      key={order.id.toString()} 
      className="bg-white dark:bg-neutral-800 rounded-md shadow-sm p-4 mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <Link 
          href={`/orders/${order.id}`}
          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          {order.orderNumber}
        </Link>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatDate(order.updatedAt)}
        </span>
      </div>
      
      <div className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">
        {order.customer.name}
      </div>
      
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {order.items.length} items · {formatCurrency(Number(order.totalAmount))}
      </div>
      
      {nextStatus && (
        <button
          onClick={() => handleUpdateStatus(order.id.toString(), nextStatus)}
          disabled={isUpdating}
          className="w-full px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {nextStatus === OrderStatus.IN_PRODUCTION && 'Start Production'}
          {nextStatus === OrderStatus.SHIPPED && 'Mark as Shipped'}
          {nextStatus === OrderStatus.CANCELLED && 'Cancel Order'}
        </button>
      )}
    </div>
  );
  
  // Render board columns
  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Confirmed Column */}
        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-md p-4">
          <h3 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white flex items-center">
            <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
            Confirmed (Ready for Production)
            <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
              ({confirmedOrders.length})
            </span>
          </h3>
          
          <div className="overflow-y-auto max-h-[70vh]">
            {confirmedOrders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center p-4">
                No orders waiting for production
              </p>
            ) : (
              confirmedOrders.map(order => renderOrderCard(order, OrderStatus.IN_PRODUCTION))
            )}
          </div>
        </div>
        
        {/* In Production Column */}
        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-md p-4">
          <h3 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white flex items-center">
            <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
            In Production
            <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
              ({productionOrders.length})
            </span>
          </h3>
          
          <div className="overflow-y-auto max-h-[70vh]">
            {productionOrders.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center p-4">
                No orders currently in production
              </p>
            ) : (
              productionOrders.map(order => renderOrderCard(order, OrderStatus.SHIPPED))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 