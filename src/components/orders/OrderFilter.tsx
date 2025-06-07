"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderStatus } from '@/lib/types/order.types';

export default function OrderFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state with URL parameters
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('searchTerm') || '');
  const [fromDate, setFromDate] = useState(searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState(searchParams.get('toDate') || '');
  
  // Update URL on filter change
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);
    
    // Update or remove status filter
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    
    // Update or remove search term
    if (searchTerm) {
      params.set('searchTerm', searchTerm);
    } else {
      params.delete('searchTerm');
    }
    
    // Update or remove date filters
    if (fromDate) {
      params.set('fromDate', fromDate);
    } else {
      params.delete('fromDate');
    }
    
    if (toDate) {
      params.set('toDate', toDate);
    } else {
      params.delete('toDate');
    }
    
    // Reset to first page when filters change
    params.set('page', '1');
    
    // Apply filters
    router.push(`?${params.toString()}`);
  };
  
  // Handle search term input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };
  
  // Reset all filters
  const resetFilters = () => {
    setStatus('');
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    
    // Reset URL parameters
    const params = new URLSearchParams();
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md shadow p-4 mb-6">
      <h2 className="text-lg font-medium mb-4 text-neutral-900 dark:text-white">Filter Orders</h2>
      
      <div className="space-y-4">
        {/* Search Term */}
        <form onSubmit={handleSearchSubmit} className="flex">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={handleSearchInput}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-l-md shadow-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Search
          </button>
        </form>
        
        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setTimeout(() => applyFilters(), 0);
              }}
              className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              {Object.values(OrderStatus).map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          {/* Date Range Filters */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setTimeout(() => applyFilters(), 0);
              }}
              className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setTimeout(() => applyFilters(), 0);
              }}
              className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white"
            />
          </div>
        </div>
        
        {/* Reset Button */}
        <div className="flex justify-end">
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
} 