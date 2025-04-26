"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Order, OrderStatus } from '@/lib/types/order.types';

type OrderTableProps = {
  orders: Order[];
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export default function OrderTable({
  orders,
  totalCount,
  page,
  perPage,
  totalPages,
}: OrderTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get the current sort parameters from the URL
  const currentSort = searchParams.get('sortBy') || 'createdAt';
  const currentDirection = searchParams.get('sortDirection') || 'desc';
  
  // Status badge color mapping
  const statusColors: Record<string, string> = {
    [OrderStatus.DRAFT]: 'bg-neutral-200 text-neutral-800',
    [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-800',
    [OrderStatus.IN_PRODUCTION]: 'bg-yellow-100 text-yellow-800',
    [OrderStatus.SHIPPED]: 'bg-green-100 text-green-800',
    [OrderStatus.DELIVERED]: 'bg-green-200 text-green-800',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800',
  };
  
  // Format date function
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };
  
  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  // Handle sorting
  const handleSort = (column: string) => {
    // If already sorting by this column, toggle direction
    let direction = 'asc';
    if (currentSort === column && currentDirection === 'asc') {
      direction = 'desc';
    }
    
    // Build new query parameters
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', column);
    params.set('sortDirection', direction);
    
    // Update URL
    router.push(`?${params.toString()}`);
  };
  
  // Handle pagination client-side
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) {
      return; // Prevent invalid page numbers
    }
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`?${params.toString()}`);
  };
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md overflow-hidden shadow">
      {/* Table Header */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('orderNumber')}
              >
                Order #
                {currentSort === 'orderNumber' && (
                  <span className="ml-1">
                    {currentDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
              >
                Customer
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('status')}
              >
                Status
                {currentSort === 'status' && (
                  <span className="ml-1">
                    {currentDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('totalAmount')}
              >
                Total
                {currentSort === 'totalAmount' && (
                  <span className="ml-1">
                    {currentDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('createdAt')}
              >
                Date
                {currentSort === 'createdAt' && (
                  <span className="ml-1">
                    {currentDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id.toString()} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    <Link href={`/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                    {order.customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        statusColors[order.status]
                      }`}
                    >
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                    {formatCurrency(Number(order.totalAmount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                    >
                      View
                    </Link>
                    {order.status === OrderStatus.DRAFT && (
                      <Link
                        href={`/orders/${order.id}/edit`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-neutral-900 px-4 py-3 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-sm font-medium rounded-md ${
                page === 1
                  ? 'text-neutral-400 dark:text-neutral-600 bg-neutral-100 dark:bg-neutral-800'
                  : 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className={`ml-3 relative inline-flex items-center px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-sm font-medium rounded-md ${
                page === totalPages
                  ? 'text-neutral-400 dark:text-neutral-600 bg-neutral-100 dark:bg-neutral-800'
                  : 'text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Showing <span className="font-medium">{(page - 1) * perPage + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(page * perPage, totalCount)}
                </span>{' '}
                of <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium ${
                    page === 1
                      ? 'text-neutral-400 dark:text-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="sr-only">Previous</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pageNum
                        ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-200'
                        : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium ${
                    page === totalPages
                      ? 'text-neutral-400 dark:text-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="sr-only">Next</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 