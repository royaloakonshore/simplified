"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Order, OrderStatus, OrderWithStockStatus } from '@/lib/types/order.types';
import { updateOrderStatus } from '@/lib/actions/order.actions';

type OrderDetailProps = {
  order: OrderWithStockStatus;
};

export default function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  
  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  // Get available status transitions
  const getAvailableStatusTransitions = (): OrderStatus[] => {
    const validTransitions: Record<string, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.IN_PRODUCTION,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.IN_PRODUCTION]: [
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.SHIPPED]: [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };
    
    return validTransitions[order.status] || [];
  };
  
  // Handle status change
  const handleStatusChange = async () => {
    if (!selectedStatus) {
      setError('Please select a status');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await updateOrderStatus(order.id.toString(), {
        status: selectedStatus,
      });
      
      if (!result.success) {
        // Handle all possible error shapes
        const errorMessage = 'error' in result 
          ? result.error 
          : 'data' in result && result.data && typeof result.data === 'object' && 'hasInsufficientStock' in result.data 
            ? 'Insufficient stock for one or more items' 
            : 'An unknown error occurred';
        
        throw new Error(errorMessage);
      }
      
      // Close modal and reset selected status
      setShowStatusModal(false);
      setSelectedStatus('');
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Status badge color mapping
  const getStatusBadgeClass = (status: string): string => {
    const statusColors: Record<string, string> = {
      [OrderStatus.DRAFT]: 'bg-neutral-200 text-neutral-800',
      [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-800',
      [OrderStatus.IN_PRODUCTION]: 'bg-yellow-100 text-yellow-800',
      [OrderStatus.SHIPPED]: 'bg-green-100 text-green-800',
      [OrderStatus.DELIVERED]: 'bg-green-200 text-green-800',
      [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800',
    };
    
    return statusColors[status] || 'bg-neutral-100 text-neutral-800';
  };
  
  const availableStatusTransitions = getAvailableStatusTransitions();
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md shadow overflow-hidden">
      {/* Order Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            Order {order.orderNumber}
          </h2>
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 text-xs rounded-full ${getStatusBadgeClass(order.status)}`}
            >
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
            {order.status === OrderStatus.DRAFT && (
              <Link
                href={`/orders/${order.id}/edit`}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Edit Order
              </Link>
            )}
            {availableStatusTransitions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Update Status
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>Created on {formatDate(order.createdAt)}</p>
        </div>
      </div>
      
      {/* Order Details */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-neutral-900 dark:text-white">Customer</h3>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{order.customer.name}</p>
            {order.customer.email && <p>{order.customer.email}</p>}
            {order.customer.phone && <p>{order.customer.phone}</p>}
            {order.customer.vatId && <p>Y-tunnus: {order.customer.vatId}</p>}
            
            {order.customer.addresses && order.customer.addresses.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                  {order.customer.addresses[0].type.charAt(0).toUpperCase() + order.customer.addresses[0].type.slice(1)} Address
                </p>
                <p>{order.customer.addresses[0].streetAddress}</p>
                <p>
                  {order.customer.addresses[0].postalCode} {order.customer.addresses[0].city}
                </p>
                <p>{order.customer.addresses[0].countryCode}</p>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <Link
              href={`/customers/${order.customer.id}`}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              View Customer
            </Link>
          </div>
        </div>
        
        {/* Order Summary */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-neutral-900 dark:text-white">Order Summary</h3>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            <div className="flex justify-between py-1">
              <span>Items:</span>
              <span>{order.items.length}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Total:</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatCurrency(Number(order.totalAmount))}
              </span>
            </div>
          </div>
          
          {/* Stock Status Warning */}
          {order.status === OrderStatus.DRAFT && order.hasInsufficientStock && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
              <p className="font-medium">Insufficient stock for some items</p>
              <ul className="mt-2 list-disc list-inside text-sm">
                {order.outOfStockItems?.map((item) => (
                  <li key={item.itemId.toString()}>
                    {item.name}: Need {Number(item.quantityRequested)}, Available {Number(item.quantityAvailable)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {order.notes && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-1 text-neutral-900 dark:text-white">Notes</h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-pre-line">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Order Items */}
      <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
        <h3 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white">
          Order Items
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                >
                  Item
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                >
                  Unit Price
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
              {order.items.map((item) => {
                const quantity = Number(item.quantity);
                const unitPrice = Number(item.unitPrice);
                const total = quantity * unitPrice;
                
                return (
                  <tr key={item.id.toString()} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-4 text-sm text-neutral-900 dark:text-neutral-100">
                      <div>
                        <span className="font-medium">{item.item.name}</span>
                      </div>
                      <div className="text-xs text-neutral-500">{item.item.sku}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-neutral-500 dark:text-neutral-400 text-right">
                      {quantity} {item.item.unitOfMeasure}
                    </td>
                    <td className="px-4 py-4 text-sm text-neutral-500 dark:text-neutral-400 text-right">
                      {formatCurrency(unitPrice)}
                    </td>
                    <td className="px-4 py-4 text-sm text-neutral-900 dark:text-neutral-100 text-right font-medium">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
              
              {/* Total Row */}
              <tr className="bg-neutral-50 dark:bg-neutral-800">
                <td colSpan={3} className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 font-medium text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 font-medium text-right">
                  {formatCurrency(Number(order.totalAmount))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                Update Order Status
              </h3>
            </div>
            
            <div className="p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  New Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  disabled={isSubmitting}
                  className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
                  required
                >
                  <option value="">Select a status</option>
                  {availableStatusTransitions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
                
                {selectedStatus === OrderStatus.CONFIRMED && order.hasInsufficientStock && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                    <p className="font-medium">Warning: Insufficient stock</p>
                    <p className="mt-1">
                      This order cannot be confirmed due to insufficient stock for one or more items.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedStatus('');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStatusChange}
                  disabled={
                    isSubmitting || 
                    !selectedStatus || 
                    (selectedStatus === OrderStatus.CONFIRMED && order.hasInsufficientStock)
                  }
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isSubmitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 